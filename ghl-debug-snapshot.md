# GHL v2 Debug Snapshot

## 1 · Overview

This bundle contains the full source code for the v2 contact-upsert pipeline, used to debug the "customFields must be an array" 422 error. The code is from a Supabase Edge Function that synchronizes tenant data from Supabase to GoHighLevel contacts and opportunities.

## 2 · File Tree

```
supabase/
└── functions/
    └── sync_leases-ts/
        └── index.ts  # Contains all the logic for the v2 contact-upsert pipeline
```

## 3 · Source Listings

### 3.1 supabase/functions/sync_leases-ts/index.ts

```ts
// supabase/functions/sync_leases.ts
// ──────────────────────────────────────────────────────────────────────────────
//  Sync NEW / UPDATED rows in  public.tenants  ➜  GoHighLevel Contacts & Opps
// ──────────────────────────────────────────────────────────────────────────────
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Validate critical environment variables
const criticalEnvVars = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GHL_API_KEY",
  "GHL_PIPELINE_ID"
];

// ──────────────────────────── Supabase (service-role) ─────────────────────────
const supa = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

// ─────────────────────────────── GHL constants ───────────────────────────────
const LOCATION_ID = "v5jAtUx8vmG1ucKOCjA8"; // 🔑 Required for location-level API keys

const GHL = {
  KEY: Deno.env.get("GHL_API_KEY"),
  KEY_V2: Deno.env.get("GHL_API_V2_KEY"),
  PIPELINE: Deno.env.get("GHL_PIPELINE_ID"),
  STAGES: {
    NEW_INQUIRY: Deno.env.get("STAGE_NEW_INQUIRY_ID"),
    NEEDS_SEARCH: Deno.env.get("STAGE_NEEDS_SEARCH_ID"),
    SEARCH_SENT: Deno.env.get("STAGE_SEARCH_SENT_ID"),
    BOOKED_2025: Deno.env.get("STAGE_BOOKED_2025_ID"),
    BOOKED_2026: Deno.env.get("STAGE_BOOKED_2026_ID"),
    PAST_GUEST: Deno.env.get("STAGE_PAST_GUEST_ID")
  }
};

// helper – trims to digits & 15-char max
const cleanPhone = (s) => s?.replace(/\D/g, "").slice(0, 15);

// wrapper for GHL v1 API calls
const ghlFetch = async (url, opts) => {
  // Create headers with LocationId
  const headers = {
    Authorization: `Bearer ${GHL.KEY}`,
    "Content-Type": "application/json",
    LocationId: LOCATION_ID,
    ...(opts.headers || {})
  };
  
  console.log(`GHL v1 request to ${url} with headers:`, JSON.stringify(headers));
  
  const res = await fetch(url, {
    ...opts,
    headers
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`GHL ${url} failed ${res.status}`, errorText);
    throw new Error(`GHL ${url} ${res.status}`);
  }
  
  return res;
};

// wrapper for GHL v2 API calls
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

// Get contact by email using v2 API
const getContactByEmailV2 = async (email) => {
  if (!email) return null;
  
  try {
    // Include locationId as query parameter
    const response = await ghlFetchV2(`https://services.leadconnectorhq.com/contacts/lookup?email=${encodeURIComponent(email)}`, {
      method: "GET"
    });
    
    const data = await response.json();
    return data?.contacts?.[0] || null;
  } catch (error) {
    console.error(`Error looking up contact by email: ${error.message}`);
    return null;
  }
};

// Helper function to map customFields from object to array
function mapCustomFields(customFields) {
  console.log("🔥 NEW mapper hit - converting customFields from object to array");
  return Object.entries(customFields || {}).map(([id, value]) => ({ id, value }));
}

// Create or update contact using v2 API
const upsertContactV2 = async (contactData) => {
  try {
    // Create a clean body with customFields as an array
    const body = {
      ...contactData,
      locationId: LOCATION_ID,
      customFields: Array.isArray(contactData.customFields) 
        ? contactData.customFields 
        : mapCustomFields(contactData.customFields)
    };
    
    // Log the exact payload being sent to the API
    console.log("🚀 FINAL body", JSON.stringify(body));
    
    const response = await ghlFetchV2("https://services.leadconnectorhq.com/contacts", {
      method: "POST",
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ v2 upsert failed", errorText);
      throw new Error(`GHL v2 contact upsert failed: ${response.status} ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error upserting contact via v2 API: ${error.message}`);
    throw error;
  }
};

// match Supabase user_uuid → GHL user_id (safer implementation)
const OWNERS = {};
const brandonUuid = Deno.env.get("SUPA_BRANDON_UUID");
const brandonUserId = Deno.env.get("GHL_BRANDON_USER_ID");
if (brandonUuid && brandonUserId) {
  OWNERS[brandonUuid] = brandonUserId;
}

const cassidyUuid = Deno.env.get("SUPA_CASSIDY_UUID");
const cassidyUserId = Deno.env.get("GHL_CASSIDY_USER_ID");
if (cassidyUuid && cassidyUserId) {
  OWNERS[cassidyUuid] = cassidyUserId;
}

console.log("OWNERS mapping:", JSON.stringify(OWNERS));

// ─────────────────────────────── HTTP handler ────────────────────────────────
serve(async () => {
  // Validate critical environment variables
  const missingCriticalVars = criticalEnvVars.filter((varName) => !Deno.env.get(varName));
  if (missingCriticalVars.length > 0) {
    console.error(`Missing critical environment variables: ${missingCriticalVars.join(', ')}`);
    return new Response(`Configuration error: Missing critical environment variables`, {
      status: 500
    });
  }

  try {
    // Check for missing GHL IDs
    const missing = Object.entries({
      PIPELINE: GHL.PIPELINE,
      ...GHL.STAGES
    }).filter(([k, v]) => !v).map(([k]) => k);
    if (missing.length) {
      console.error(`Missing GHL IDs: ${missing.join(", ")}`);
      return new Response(`Configuration error: Missing GHL IDs: ${missing.join(", ")}`, {
        status: 500
      });
    }

    // 1️⃣ checkpoint (first run falls back to 2000-01-01)
    const { data: ckpt, error: ckptError } = await supa.from("sync_state").select("last_run_at").eq("id", "ghl_lease_sync").single();
    
    if (ckptError) {
      console.error("Error fetching checkpoint:", ckptError.message);
      return new Response("Error fetching checkpoint", { status: 500 });
    }
    
    const sinceISO = new Date(ckpt?.last_run_at ?? "2000-01-01T00:00:00Z").toISOString();
    console.log("⏱ since", sinceISO);
    
    // DEBUG: Check if there are any tenants after this date directly
    const { data: debugTenants } = await supa.from("tenants")
      .select("id,created_at,last_scraped_at")
      .or(`created_at.gte.${sinceISO},last_scraped_at.gte.${sinceISO}`)
      .limit(5);
    
    console.log("DEBUG tenants:", JSON.stringify(debugTenants));
    
    // 2️⃣ pull tenants created OR updated after checkpoint
    const { data: leases, error } = await supa.from("tenants").select("*").or(`created_at.gte.${sinceISO},last_scraped_at.gte.${sinceISO}`).order("created_at", {
      ascending: true
    });
    
    console.log("📝 rows", leases?.length ?? 0, "error", error?.message ?? "none");
    
    if (error) {
      return new Response("Supabase read failed: " + error.message, {
        status: 500
      });
    }
    
    if (!leases?.length) {
      return new Response("No new tenants", {
        status: 200
      });
    }
    
    // Track successfully processed tenants
    const processedTenants = [];
    
    // 3️⃣ iterate over new / changed tenants
    for (const r of leases) {
      try {
        // Declare existing at the top level of the loop so it's visible throughout
        let existing: any = null;
        
        console.log(`Processing tenant ${r.id}: ${r.first_name} ${r.last_name}`);
        
        // Create contact object with required fields
        const contact = {
          email: r.tenant_email || "",
          firstName: r.first_name || "",
          lastName: r.last_name || "",
          customField: []
        };
        
        // Add phone with cleaning and validation (ensure 10-15 digits)
        const cleanedPhone = cleanPhone(r.tenant_phone?.[0]);
        if (cleanedPhone && cleanedPhone.length >= 10 && cleanedPhone.length <= 15 && !cleanedPhone.startsWith('0')) {
          contact.phone = cleanedPhone;
          console.log(`Using cleaned phone: ${cleanedPhone}`);
        } else if (r.tenant_phone?.[0]) {
          console.log(`Invalid phone number after cleaning: ${cleanedPhone}`);
        }
        
        // Only add assignedTo if it exists
        const assignedTo = OWNERS[r.user_id];
        if (assignedTo) {
          console.log(`Assigning tenant ${r.id} to ${assignedTo}`);
          contact.assignedTo = assignedTo;
        } else {
          console.log(`No assignedTo found for user_id ${r.user_id}`);
        }
        
        // Add only the tenant ID custom field for simplicity
        const cfTenantId = Deno.env.get("CF_SUPABASE_TENANT_ID");
        if (cfTenantId) {
          contact.customField.push({ id: cfTenantId, value: String(r.id) });
        }
        
        // rent-totals
        const year = r.check_in_date?.substring(0, 4);
        const rent = Number(r.rent ?? 0);
        
        if (rent > 0 && year) {
          // existing is now declared at the top of the loop
          
          try {
            // Use v2 API to look up contact
            console.log(`Searching for existing contact with email ${r.tenant_email}`);
            existing = await getContactByEmailV2(r.tenant_email);
            console.log(`Found existing contact: ${existing ? 'yes' : 'no'}`);
          } catch (error) {
            console.error(`Error searching GHL contact: ${error.message}`);
            // Continue with existing = null
          }
          
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
        
        // Log the full contact object for debugging
        console.log(`Contact object for tenant ${r.id}:`, JSON.stringify(contact));
        
        // upsert Contact with v2 API
        try {
          console.log(`Upserting contact for tenant ${r.id}`);
          
          // Ensure customField is an array of objects with id and value properties
          if (contact.customField && Array.isArray(contact.customField)) {
            console.log(`Contact has ${contact.customField.length} custom fields`);
          } else {
            console.log(`Initializing customField as empty array`);
            contact.customField = [];
          }
          
          console.log("🔥🔥🔥 BEFORE CONVERSION - CONTACT OBJECT:", JSON.stringify(contact));
          
          // Convert customField array to customFields array for v2 API
          const customFieldsArray = contact.customField.map(field => ({
            id: field.id,
            value: field.value
          }));
          
          // Format contact for v2 API
          const v2ContactPayload = {
            email: contact.email,
            firstName: contact.firstName,
            lastName: contact.lastName,
            phone: contact.phone,
            locationId: LOCATION_ID,
            customFields: customFieldsArray,
            ...(contact.assignedTo ? { assignedTo: contact.assignedTo } : {})
          };
          
          // Debug log the exact payload being sent
          console.log(`🔥🔥🔥 AFTER CONVERSION - V2 PAYLOAD for tenant ${r.id}:`, JSON.stringify(v2ContactPayload));
          
          // Debug log the exact payload being sent
          console.log(`DEBUG v2 contact payload for tenant ${r.id}:`, JSON.stringify(v2ContactPayload, null, 2));
          
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
        
        // choose Opportunity stage with fallback
        let stageId = GHL.STAGES.NEW_INQUIRY;
        
        if (year === "2026") stageId = GHL.STAGES.BOOKED_2026 || stageId;
        else if (year === "2025") stageId = GHL.STAGES.BOOKED_2025 || stageId;
        else if (r.status === "needs_search") stageId = GHL.STAGES.NEEDS_SEARCH || stageId;
        else if (r.status === "search_sent") stageId = GHL.STAGES.SEARCH_SENT || stageId;
        else if (Number(year) < 2025) stageId = GHL.STAGES.PAST_GUEST || stageId;
        
        console.log(`Using stage ID ${stageId} for tenant ${r.id}`);
        
        // Only create opportunity if we have required fields
        // Also ensure we're in the same rent > 0 && year condition as where we set existing
        if (rent > 0 && year && stageId) {
          // upsert Opportunity with direct fetch
          try {
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
            
            console.log(`Opportunity upsert response status: ${opportunityResponse.status}`);
            
            if (!opportunityResponse.ok) {
              const errorText = await opportunityResponse.text();
              console.error(`GHL opportunity upsert failed: ${opportunityResponse.status} ${errorText}`);
              // Continue to next tenant
            } else {
              console.log(`Opportunity upsert successful for tenant ${r.id}`);
            }
          } catch (error) {
            console.error(`Error upserting GHL opportunity: ${error.message}`);
            // Continue to next tenant
          }
        } else {
          console.log(`Skipping opportunity creation for tenant ${r.id} (rent: ${rent}, stageId: ${stageId})`);
        }
        
        // Mark tenant as successfully processed
        processedTenants.push(r);
        console.log(`Successfully processed tenant ${r.id}`);
        
      } catch (error) {
        console.error(`Error processing tenant ${r.id}: ${error.message}`);
        // Continue to next tenant
      }
    }
    
    // 4️⃣ write new checkpoint only if we processed at least one tenant
    if (processedTenants.length > 0) {
      try {
        // Find the latest timestamp from processed tenants
        const latestTimestamp = processedTenants.reduce((latest, tenant) => {
          const tenantTimestamp = new Date(
            tenant.last_scraped_at && tenant.created_at
              ? new Date(tenant.last_scraped_at) > new Date(tenant.created_at)
                ? tenant.last_scraped_at
                : tenant.created_at
              : tenant.last_scraped_at || tenant.created_at
          );
          return tenantTimestamp > latest ? tenantTimestamp : latest;
        }, new Date(sinceISO));
        
        console.log(`Updating checkpoint to ${latestTimestamp.toISOString()}`);
        
        const { error: updateError } = await supa.from("sync_state").upsert({
          id: "ghl_lease_sync",
          last_run_at: latestTimestamp.toISOString()
        });
        
        if (updateError) {
          console.error(`Failed to update checkpoint: ${updateError.message}`);
          return new Response(`Synced ${processedTenants.length} tenants but failed to update checkpoint`, {
            status: 500
          });
        }
        
        return new Response(`Synced ${processedTenants.length} tenants`, {
          status: 200
        });
      } catch (error) {
        console.error(`Error updating checkpoint: ${error.message}`);
        return new Response(`Synced ${processedTenants.length} tenants but failed to update checkpoint: ${error.message}`, {
          status: 500
        });
      }
    } else {
      // Always update the checkpoint even if no tenants were processed
      // This prevents the function from checking the same time range repeatedly
      try {
        console.log(`No tenants processed, updating checkpoint to current time`);
        
        const { error: updateError } = await supa.from("sync_state").upsert({
          id: "ghl_lease_sync",
          last_run_at: new Date().toISOString()
        });
        
        if (updateError) {
          console.error(`Failed to update checkpoint: ${updateError.message}`);
          return new Response(`Processed 0 tenants but failed to update checkpoint`, {
            status: 500
          });
        }
        
        return new Response(`Processed 0 tenants successfully`, {
          status: 200
        });
      } catch (error) {
        console.error(`Error updating checkpoint: ${error.message}`);
        return new Response(`Processed 0 tenants but failed to update checkpoint: ${error.message}`, {
          status: 500
        });
      }
    }
  } catch (error) {
    console.error("Unhandled error:", error.message);
    return new Response(`Unhandled error: ${error.message}`, {
      status: 500
    });
  }
});
```

## 4 · Build / Run Notes

To run the function locally:

```bash
# Set up environment variables
supabase secrets set --env-file .env --project-ref bcuwccyyjgmshslnkpyv

# Serve the function locally
supabase functions serve sync_leases-ts --env-file ./supabase/.env.local

# Test the function
curl -X POST "http://localhost:54321/functions/v1/sync_leases-ts" \
  -H "Content-Type: application/json" \
  -d '{}'
```

To deploy the function:

```bash
# Deploy the function
supabase functions deploy sync_leases-ts --project-ref bcuwccyyjgmshslnkpyv

# Test the deployed function
curl -X POST "https://bcuwccyyjgmshslnkpyv.functions.supabase.co/sync_leases-ts" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'