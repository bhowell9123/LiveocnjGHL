// @ts-nocheck
// check-phone-formatting.ts
// Check for phone number formatting issues in GoHighLevel contacts
// Usage: deno run --allow-net --allow-env --allow-read --allow-write check-phone-formatting.ts [--output=formatting-issues.json]

// Import required modules
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parse } from "https://deno.land/std@0.224.0/flags/mod.ts";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// Load environment variables
const env = await load({ export: true, path: ".env" });

// Parse command line arguments
const args = parse(Deno.args, {
  string: ["output"],
  default: {
    "output": "formatting-issues.json"
  }
});

const outputFile = args["output"];

// Create Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ghlApiKey = Deno.env.get("GHL_API_V2_KEY"); // Using V2 API key instead of V1
const ghlLocationId = Deno.env.get("LOCATION_ID"); // Using LOCATION_ID instead of GHL_LOCATION_ID
const cfSupabaseTenantId = Deno.env.get("CF_SUPABASE_TENANT_ID"); // Custom field ID for tenant_id
const cfSecondaryPhone = Deno.env.get("CF_SECONDARY_PHONE"); // Custom field ID for secondary phone

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are not set");
  console.log("Please set them in your .env file");
  Deno.exit(1);
}

if (!ghlApiKey || !ghlLocationId) {
  console.error("Error: GHL_API_V2_KEY or LOCATION_ID environment variables are not set");
  console.log("Please set them in your .env file");
  Deno.exit(1);
}

if (!cfSupabaseTenantId) {
  console.error("Error: CF_SUPABASE_TENANT_ID environment variable is not set");
  console.log("Please set it in your .env file");
  Deno.exit(1);
}

console.log("Environment variables loaded successfully");

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to clean phone numbers
function cleanPhoneNumber(phone: string): string {
  if (!phone) return "";
  // Remove all non-digit characters
  return phone.replace(/\D/g, "");
}

// Helper function to format phone numbers
function formatPhoneNumber(phone: string): string {
  // If the phone contains multiple numbers separated by slash, take only the first one
  if (phone.includes("/")) {
    phone = phone.split("/")[0].trim();
  }
  
  const cleaned = cleanPhoneNumber(phone);
  if (cleaned.length === 0) return "";
  
  // Standard phone number formatting:
  // - If it's 10 digits (US number without country code), add +1
  // - If it's 11 digits and starts with 1 (US number with country code), add +
  // - Otherwise, just add + and ensure max 15 digits
  
  let formatted = "";
  if (cleaned.length === 10) {
    formatted = `+1${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
    formatted = `+${cleaned}`;
  } else {
    // Ensure we only take the first 15 digits to avoid concatenation issues
    const truncated = cleaned.slice(0, 15);
    formatted = truncated.startsWith("+") ? truncated : `+${truncated}`;
  }
  
  return formatted;
}

// Helper function to check if a phone number has formatting issues
function hasPhoneFormattingIssues(ghlPhone: string, tenantPhone: string): boolean {
  if (!ghlPhone || !tenantPhone) return false;
  
  const cleanedGHL = cleanPhoneNumber(ghlPhone);
  const cleanedTenant = cleanPhoneNumber(tenantPhone);
  
  // Case 1: Obvious concatenation (extremely long numbers)
  if (cleanedGHL.length > 15) {
    console.log(`Phone issue: Number too long (${cleanedGHL.length} digits)`);
    return true;
  }
  
  // Case 2: Numbers that are too short (missing country code or digits)
  if (cleanedGHL.length < 10) {
    console.log(`Phone issue: Number too short (${cleanedGHL.length} digits)`);
    return true;
  }
  
  // Case 3: Detect specific known issues like concatenated numbers
  const knownIssues = [
    "908581895590880",  // Betsy Taylor
    "610462161626730",
    "215540090521580",
    "856780575860977",  // Caty Or Gail Berman
    "1908581895590880", // Another format of Betsy's number
    "48 43903812"       // Dan Bernstein
  ];
  
  for (const issue of knownIssues) {
    if (ghlPhone.includes(issue)) {
      console.log(`Phone issue: Known concatenated number pattern detected (${issue})`);
      return true;
    }
  }
  
  // Case 4: Check for duplicate patterns that indicate concatenation
  if (cleanedGHL.length >= 14) {
    // Look for repeating patterns
    for (let i = 4; i <= 10; i++) {
      const pattern = cleanedGHL.substring(0, i);
      if (cleanedGHL.indexOf(pattern, i) > 0) {
        console.log(`Phone issue: Repeating pattern detected (${pattern})`);
        return true;
      }
    }
    
    // Additional check for extremely long numbers (likely concatenated)
    if (cleanedGHL.length > 15) {
      console.log(`Phone issue: Extremely long number (${cleanedGHL.length} digits)`);
      return true;
    }
  }
  
  // Case 5: Check for unusual formats like "+55 51234567" (missing digits)
  if (ghlPhone.includes(" ") && cleanedGHL.length < 11) {
    console.log(`Phone issue: Unusual format with spaces and too few digits`);
    return true;
  }
  
  // Case 5: Check if the GHL phone number is significantly different from tenant phone
  // Only consider this if the tenant phone is a reasonable length (10-15 digits)
  if (cleanedTenant.length >= 10 && cleanedTenant.length <= 15) {
    if (Math.abs(cleanedGHL.length - cleanedTenant.length) > 3) {
      console.log(`Phone issue: Length mismatch (GHL: ${cleanedGHL.length}, Tenant: ${cleanedTenant.length})`);
      return true;
    }
  }
  
  return false;
}

// Main function
async function main() {
  console.log("=== Check Phone Number Formatting Issues ===");
  console.log(`Output file: ${outputFile}`);
  
  try {
    // Fetch all tenants from Supabase
    console.log("Fetching tenants from Supabase...");
    const { data: tenants, error: tenantsError } = await supabase
      .from("tenants")
      .select("id, first_name, last_name, tenant_email, tenant_phone")
      .not("tenant_phone", "is", null);
    
    if (tenantsError) {
      throw new Error(`Error fetching tenants: ${tenantsError.message}`);
    }
    
    console.log(`Fetched ${tenants.length} tenants from Supabase`);
    
    // Create a map of tenant IDs to tenant data for easier lookup
    const tenantMap = new Map();
    for (const tenant of tenants) {
      tenantMap.set(String(tenant.id), tenant);
    }
    
    console.log(`Created a map of ${tenantMap.size} tenants with valid phone numbers`);
    
    // Fetch all contacts from GoHighLevel
    console.log("Fetching contacts from GoHighLevel...");
    
    let allContacts = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const response = await fetch(`https://services.leadconnectorhq.com/contacts?locationId=${ghlLocationId}&limit=100&page=${page}`, {
        headers: {
          "Authorization": `Bearer ${ghlApiKey}`,
          "Version": "2021-07-28",
          "Accept": "application/json"
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error fetching contacts from GoHighLevel: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      const contacts = data.contacts || [];
      
      allContacts = allContacts.concat(contacts);
      
      console.log(`Fetched ${contacts.length} contacts from page ${page}`);
      
      hasMore = contacts.length === 100;
      page++;
      
      // Add a small delay to avoid rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`Fetched a total of ${allContacts.length} contacts from GoHighLevel`);
    
    // Find contacts with formatting issues
    console.log("Checking for phone number formatting issues...");
    
    const formattingIssues = [];
    
    for (const contact of allContacts) {
      // Skip contacts without custom fields
      if (!contact.customFields || !Array.isArray(contact.customFields)) {
        continue;
      }
      
      // Find the tenant ID custom field using the environment variable
      const tenantIdField = contact.customFields.find(field =>
        field.id === cfSupabaseTenantId);
      
      if (!tenantIdField || !tenantIdField.value) {
        continue;
      }
      
      const tenantId = tenantIdField.value;
      const tenant = tenantMap.get(String(tenantId));
      
      if (!tenant) {
        continue;
      }
      
      // Check if the contact has a phone number
      if (!contact.phone) {
        continue;
      }
      
      // Get the tenant's phone numbers
      let primaryPhone = "";
      let secondaryPhone = "";
      
      if (Array.isArray(tenant.tenant_phone) && tenant.tenant_phone.length > 0) {
        // Extract primary phone
        let firstPhone = tenant.tenant_phone[0];
        
        // If the phone contains multiple numbers separated by slash, split them
        if (firstPhone.includes("/")) {
          const phoneParts = firstPhone.split("/").map(p => p.trim());
          primaryPhone = phoneParts[0];
          if (phoneParts.length > 1 && !secondaryPhone) {
            secondaryPhone = phoneParts[1];
          }
        } else {
          primaryPhone = firstPhone;
        }
        
        // Extract secondary phone if available in array
        if (tenant.tenant_phone.length > 1 && !secondaryPhone) {
          secondaryPhone = tenant.tenant_phone[1];
        }
        
        console.log(`Tenant ${tenant.id} primary phone: ${primaryPhone}, secondary phone: ${secondaryPhone}`);
      } else if (typeof tenant.tenant_phone === "string") {
        // If the phone contains multiple numbers separated by slash, split them
        let phoneStr = tenant.tenant_phone;
        if (phoneStr.includes("/")) {
          const phoneParts = phoneStr.split("/").map(p => p.trim());
          primaryPhone = phoneParts[0];
          if (phoneParts.length > 1) {
            secondaryPhone = phoneParts[1];
          }
        } else {
          primaryPhone = phoneStr;
        }
        
        console.log(`Tenant ${tenant.id} primary phone: ${primaryPhone}, secondary phone: ${secondaryPhone}`);
      }
      
      if (!primaryPhone) {
        continue;
      }
      
      // Get the contact's secondary phone from custom fields if available
      let contactSecondaryPhone = "";
      if (cfSecondaryPhone && contact.customFields && Array.isArray(contact.customFields)) {
        const secondaryPhoneField = contact.customFields.find(field => field.id === cfSecondaryPhone);
        if (secondaryPhoneField && secondaryPhoneField.value) {
          contactSecondaryPhone = secondaryPhoneField.value;
          console.log(`Found secondary phone in contact: ${contactSecondaryPhone}`);
        }
      }
      
      // Check if the primary phone number has formatting issues
      if (hasPhoneFormattingIssues(contact.phone, primaryPhone)) {
        formattingIssues.push({
          contactId: contact.id,
          contactName: `${contact.firstName || ""} ${contact.lastName || ""}`.trim(),
          contactPhone: contact.phone,
          tenantID: tenant.id,
          tenantName: `${tenant.first_name || ""} ${tenant.last_name || ""}`.trim(),
          tenantPhone: primaryPhone,
          expectedPhone: formatPhoneNumber(primaryPhone),
          phoneType: "primary"
        });
      }
      
      // Check if the secondary phone number has formatting issues
      if (secondaryPhone && contactSecondaryPhone && hasPhoneFormattingIssues(contactSecondaryPhone, secondaryPhone)) {
        formattingIssues.push({
          contactId: contact.id,
          contactName: `${contact.firstName || ""} ${contact.lastName || ""}`.trim(),
          contactPhone: contactSecondaryPhone,
          tenantID: tenant.id,
          tenantName: `${tenant.first_name || ""} ${tenant.last_name || ""}`.trim(),
          tenantPhone: secondaryPhone,
          expectedPhone: formatPhoneNumber(secondaryPhone),
          phoneType: "secondary"
        });
      }
    }
    
    // Sort formatting issues by tenant name for easier reading
    formattingIssues.sort((a, b) => a.tenantName.localeCompare(b.tenantName));
    
    console.log(`Found ${formattingIssues.length} contacts with phone number formatting issues`);
    
    // Print a summary of the issues found
    if (formattingIssues.length > 0) {
      console.log("\nSummary of formatting issues:");
      console.log("-----------------------------");
      formattingIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.contactName} (${issue.tenantName})`);
        console.log(`   Current GHL ${issue.phoneType} phone: ${issue.contactPhone}`);
        console.log(`   Expected ${issue.phoneType} phone: ${issue.expectedPhone}`);
        console.log("-----------------------------");
      });
    }
    
    // Write the formatting issues to the output file
    await Deno.writeTextFile(outputFile, JSON.stringify(formattingIssues, null, 2));
    
    console.log(`Formatting issues written to ${outputFile}`);
    
    if (formattingIssues.length > 0) {
      console.log("\nTo fix these formatting issues, run:");
      console.log("deno run --allow-net --allow-env --allow-read fix-phone-formatting.ts");
      console.log("\nTo see what changes would be made without applying them, run:");
      console.log("deno run --allow-net --allow-env --allow-read fix-phone-formatting.ts --dry-run");
    } else {
      console.log("\nNo formatting issues found. No action needed.");
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    Deno.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error("Unhandled error:", error);
  Deno.exit(1);
});