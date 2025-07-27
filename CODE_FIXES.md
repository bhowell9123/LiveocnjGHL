# Code Fixes for Identified Issues

This document provides specific code fixes for the issues identified in the Supabase → GoHighLevel sync project.

## 1. customFields Object vs Array Issue

The GoHighLevel API expects `customFields` to be an array of objects with `id` and `value` properties, but sometimes it becomes an object.

### Fix:

```javascript
// Add this helper function to map customFields from object to array
function mapCustomFields(customFields) {
  console.log("Converting customFields from object to array");
  return Object.entries(customFields || {}).map(([id, value]) => ({ id, value }));
}

// In the upsertContactV2 function, modify to handle both formats:
const upsertContactV2 = async (contactData) => {
  try {
    // Force customFields to be an array, no matter what
    let customFieldsArray;
    
    if (Array.isArray(contactData.customFields)) {
      customFieldsArray = contactData.customFields;
      console.log("customFields is already an array, using as-is");
    } else if (typeof contactData.customFields === 'object' && contactData.customFields !== null) {
      customFieldsArray = Object.entries(contactData.customFields).map(([id, value]) => ({ id, value }));
      console.log("Converting customFields from object to array format");
    } else {
      // If customFields is missing or invalid, use an empty array
      customFieldsArray = [];
      console.log("No valid customFields found, using empty array");
    }
    
    // Create a clean body with customFields as an array
    const body = {
      ...contactData,
      locationId: LOCATION_ID,
      customFields: customFieldsArray
    };
    
    // Delete the old customField property if it exists to avoid confusion
    if ('customField' in body) {
      delete body.customField;
    }
    
    // Rest of the function...
  } catch (error) {
    // Error handling...
  }
};
```

## 2. Race Conditions with Duplicate Contacts

When two tenant rows sync simultaneously, race conditions can occur, leading to duplicate contacts.

### Fix:

```javascript
// In the main processing loop, add proper contact lookup and error handling:

// Use v2 API to look up contact
try {
  console.log(`Searching for existing contact with email ${r.tenant_email}`);
  existing = await getContactByEmailV2(r.tenant_email);
  console.log(`Found existing contact: ${existing ? 'yes' : 'no'}`);
} catch (error) {
  console.error(`Error searching GHL contact: ${error.message}`);
  // Continue with existing = null
}

// When upserting the contact, add proper error handling:
try {
  console.log(`Upserting contact for tenant ${r.id}`);
  
  // Use v2 API to upsert contact
  const contactData = await upsertContactV2(v2ContactPayload);
  
  if (contactData && contactData.id) {
    existing = contactData;
    console.log(`Contact upsert successful for tenant ${r.id} with ID ${existing.id}`);
  } else {
    console.error(`GHL contact upsert failed: No contact ID returned`);
    continue; // Skip this tenant but continue processing others
  }
} catch (error) {
  console.error(`Error upserting GHL contact: ${error.message}`);
  continue; // Skip this tenant but continue processing others
}
```

## 3. Phone Number Formatting Problems

Phone numbers with multiple values (e.g., "8567805758 / 6097744077") were being concatenated into a single string.

### Fix:

```javascript
// Replace the phone number handling code with this:

// Handle phone numbers properly - tenant_phone can be an array of phone numbers
if (r.tenant_phone && Array.isArray(r.tenant_phone) && r.tenant_phone.length > 0) {
  // Process the first phone number for the primary phone field
  const firstPhone = r.tenant_phone[0];
  console.log(`Processing first phone number: ${firstPhone}`);
  
  const cleanedPhone = cleanPhone(firstPhone);
  if (cleanedPhone && cleanedPhone.length >= 10 && cleanedPhone.length <= 15 && !cleanedPhone.startsWith('0')) {
    // Format the phone number with international format
    contact.phone = `+${cleanedPhone}`;
    console.log(`Using cleaned phone: ${contact.phone}`);
  } else if (firstPhone) {
    console.log(`Invalid phone number after cleaning: ${cleanedPhone}`);
  }
  
  // Process the second phone number if available
  if (r.tenant_phone.length > 1) {
    const secondPhone = r.tenant_phone[1];
    console.log(`Processing second phone number: ${secondPhone}`);
    
    const cleanedSecondPhone = cleanPhone(secondPhone);
    if (cleanedSecondPhone && cleanedSecondPhone.length >= 10 && cleanedSecondPhone.length <= 15 && !cleanedSecondPhone.startsWith('0')) {
      // Get the custom field ID for secondary phone
      const cfSecondaryPhoneId = Deno.env.get("CF_SECONDARY_PHONE");
      if (cfSecondaryPhoneId) {
        contact.customField.push({
          id: cfSecondaryPhoneId,
          value: `+${cleanedSecondPhone}`
        });
        console.log(`Added second phone as custom field: +${cleanedSecondPhone}`);
      } else {
        console.log(`No custom field ID for secondary phone found, skipping second phone`);
      }
    } else if (secondPhone) {
      console.log(`Invalid second phone number after cleaning: ${cleanedSecondPhone}`);
    }
  }
} else {
  console.log(`No valid phone numbers found for tenant ${r.id}`);
}
```

## 4. Rental History Grouping Strategy

Multiple rental rows for the same tenant need to be grouped into one contact while maintaining separate rental history.

### Fix:

```javascript
// Add this code to handle rental history grouping:

// rent-totals
const year = r.check_in_date?.substring(0, 4);
const rent = Number(r.rent ?? 0);

if (rent > 0 && year) {
  // Safe JSON parsing
  let totals = {};
  try {
    if (existing?.customField?.yearly_rent_totals_json) {
      totals = JSON.parse(existing.customField.yearly_rent_totals_json);
      console.log(`Parsed existing yearly_rent_totals_json: ${JSON.stringify(totals)}`);
    }
  } catch (error) {
    console.error(`Error parsing yearly_rent_totals_json: ${error.message}`);
    // Continue with empty totals object
  }
  
  totals[year] = (totals[year] ?? 0) + rent;
  
  // Calculate the total lifetime rent
  const totalLifetimeRent = Object.values(totals).reduce((a, b) => a + Number(b), 0);
  
  // Add yearly rent totals as a custom field with proper format
  const yearlyRentTotalsId = Deno.env.get("CF_YEARLY_RENT_TOTALS_JSON");
  if (yearlyRentTotalsId) {
    contact.customField.push({
      id: yearlyRentTotalsId,
      value: JSON.stringify(totals)
    });
  }
  
  // Add total lifetime rent as a custom field with proper format
  const totalLifetimeRentId = Deno.env.get("CF_TOTAL_LIFETIME_RENT");
  if (totalLifetimeRentId) {
    contact.customField.push({
      id: totalLifetimeRentId,
      value: String(totalLifetimeRent)
    });
  }
  
  console.log(`Updated yearly_rent_totals_json: ${JSON.stringify(totals)}`);
  console.log(`Total lifetime rent: ${totalLifetimeRent}`);
}
```

## 5. GHL API v1 to v2 Migration

The project needs to migrate from GHL API v1 to v2 for opportunities.

### Fix:

```javascript
// Add this wrapper for GHL v2 API calls:

const ghlFetchV2 = async (url, opts) => {
  // Create headers with Authorization and Version
  const headers = {
    Authorization: `Bearer ${GHL.KEY_V2}`,
    "Content-Type": "application/json",
    Version: "2021-07-28", // Recommended for API stability
    ...(opts.headers || {})
  };
  
  console.log(`GHL v2 request to ${url} with headers:`, JSON.stringify(headers));
  
  // For GET requests with query parameters
  if (opts.method === "GET" && !url.includes("locationId=")) {
    // Add locationId as query parameter if not already present
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}locationId=${LOCATION_ID}`;
  }
  
  // For POST requests, ensure locationId is in the body
  if (opts.method === "POST" && opts.body) {
    let body;
    try {
      body = JSON.parse(opts.body);
      if (!body.locationId) {
        body.locationId = LOCATION_ID;
        opts.body = JSON.stringify(body);
      }
    } catch (e) {
      console.error("Error parsing request body:", e);
    }
  }
  
  const res = await fetch(url, {
    ...opts,
    headers
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`GHL v2 ${url} failed ${res.status}`, errorText);
    throw new Error(`GHL v2 ${url} ${res.status}`);
  }
  
  return res;
};

// Update opportunity creation to use v2 API:

// Create opportunity payload with proper TypeScript interface for v2 API
const v2Payload: {
  externalId: string;
  name: string;
  pipelineId: string;
  stageId: string;
  status: string;
  monetaryValue: number;
  contactId?: string;
} = {
  externalId: r.confirmation_number || `tenant-${r.id}`,
  name: r.confirmation_number || `Tenant ${r.id}`,
  pipelineId: GHL.PIPELINE,
  stageId,
  status: "open",
  monetaryValue: rent
};

// Must have a contactId for v2 API opportunities
if (existing?.id) {
  v2Payload.contactId = existing.id;
  console.log(`Using contactId ${existing.id} for tenant ${r.id}`);
} else {
  console.error(`No contact ID available for tenant ${r.id}, cannot create opportunity`);
  continue; // Skip opportunity creation for this tenant
}

console.log(`V2 opportunity payload for tenant ${r.id}:`, JSON.stringify(v2Payload));

// Ensure locationId is in the opportunity payload
const opportunityPayloadWithLocation = {
  ...v2Payload,
  locationId: LOCATION_ID
};

const opportunityResponse = await ghlFetchV2("https://services.leadconnectorhq.com/opportunities", {
  method: "POST",
  body: JSON.stringify(opportunityPayloadWithLocation)
});
```

## Implementation Notes

1. These fixes should be applied to the main Edge Function file at `supabase/functions/sync_leases-ts/index.ts`.
2. After applying the fixes, test the function locally before deploying to production.
3. Monitor the logs after deployment to ensure the fixes are working as expected.
4. Consider adding additional error handling and logging to help diagnose any issues that may arise.