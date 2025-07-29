#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * backfill-missing-contacts.ts
 * 
 * This script finds tenants in Supabase that don't have corresponding contacts in GHL,
 * creates contacts for them, and adds a note to each contact indicating it was created
 * by the backfill script.
 * 
 * Usage:
 *   deno run --allow-net --allow-env --allow-read scripts/backfill-missing-contacts.ts [options]
 * 
 * Options:
 *   --dry-run          Run in dry-run mode (no actual updates)
 *   --batch-size=200   Number of contacts to process in each batch (default: 200)
 *   --sleep=2000       Milliseconds to sleep between batches (default: 2000)
 *   --rate=150         Maximum number of contacts to process per minute (default: 150)
 */

import { parse } from "https://deno.land/std/flags/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { cleanPhone } from "../lib/utils.ts";

// Parse command line arguments
const args = parse(Deno.args, {
  boolean: ["dry-run"],
  string: ["batch-size", "sleep", "rate"],
  default: {
    "dry-run": false,
    "batch-size": "200",
    "sleep": "2000",
    "rate": "150"
  }
});

const DRY_RUN = args["dry-run"];
const BATCH_SIZE = parseInt(args["batch-size"], 10);
const SLEEP_MS = parseInt(args["sleep"], 10);
const RATE_LIMIT = parseInt(args["rate"], 10);

// Get environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ghlApiKey = Deno.env.get("GHL_API_V2_KEY");
const ghlLocationId = Deno.env.get("LOCATION_ID") || "v5jAtUx8vmG1ucKOCjA8";

// Custom field IDs
const CUSTOM_FIELD_IDS = {
  TENANT_ID: Deno.env.get("CF_SUPABASE_TENANT_ID"),
  SECONDARY_PHONE: Deno.env.get("CF_SECONDARY_PHONE"),
  YEARLY_RENT_TOTALS: Deno.env.get("CF_YEARLY_RENT_TOTALS_JSON"),
  TOTAL_LIFETIME_RENT: Deno.env.get("CF_TOTAL_LIFETIME_RENT")
};

// Validate required environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error("Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are not set");
  console.log("Please set them in your .env file");
  Deno.exit(1);
}

if (!ghlApiKey) {
  console.error("Error: GHL_API_V2_KEY environment variable is not set");
  console.log("Please set it in your .env file");
  Deno.exit(1);
}

if (!CUSTOM_FIELD_IDS.TENANT_ID) {
  console.error("Error: CF_SUPABASE_TENANT_ID environment variable is not set");
  console.log("This is required to store the tenant ID in the contact");
  Deno.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Sleep function to avoid rate limits
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Format phone number to E.164 format
function formatPhoneToE164(phone: string): string {
  const cleaned = cleanPhone(phone);
  
  // If the number is too short, return as is
  if (cleaned.length < 10) return `+${cleaned}`;
  
  // If it's a US number (10 or 11 digits with leading 1)
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+${cleaned}`;
  }
  
  // For other international numbers, just add the + prefix
  return `+${cleaned}`;
}

// Interface for tenant data
interface Tenant {
  id: number;
  tenant_email: string;
  first_name: string;
  last_name: string;
  tenant_phone: string[] | null;
  confirmation_number: string | null;
  check_in_date: string | null;
  rent: number | null;
  created_at: string;
}

// Function to fetch tenants from Supabase
async function fetchTenantsFromSupabase(): Promise<Tenant[]> {
  console.log("Fetching tenants from Supabase...");
  
  try {
    const { data, error } = await supabase
      .from("tenants")
      .select("id, tenant_email, first_name, last_name, tenant_phone, confirmation_number, check_in_date, rent, created_at")
      .order("created_at", { ascending: false });
    
    if (error) {
      throw new Error(`Error fetching tenants: ${error.message}`);
    }
    
    console.log(`Fetched ${data.length} tenants from Supabase`);
    return data;
  } catch (error) {
    console.error("Error fetching tenants:", error instanceof Error ? error.message : String(error));
    return [];
  }
}

// Function to check if a contact exists in GoHighLevel
async function contactExistsInGHL(email: string, phone: string | null, tenantId: number): Promise<boolean> {
  try {
    // Try to find by email first
    if (email) {
      const response = await fetch(
        `https://services.leadconnectorhq.com/contacts/lookup?email=${encodeURIComponent(email)}&locationId=${ghlLocationId}`,
        {
          headers: {
            "Authorization": `Bearer ${ghlApiKey}`,
            "Version": "2021-07-28",
            "Content-Type": "application/json"
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error looking up contact by email: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      if (data?.contacts?.length > 0) {
        return true;
      }
    }
    
    // Try to find by phone if email search failed
    if (phone) {
      const response = await fetch(
        `https://services.leadconnectorhq.com/contacts/lookup?phone=${encodeURIComponent(phone)}&locationId=${ghlLocationId}`,
        {
          headers: {
            "Authorization": `Bearer ${ghlApiKey}`,
            "Version": "2021-07-28",
            "Content-Type": "application/json"
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error looking up contact by phone: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      if (data?.contacts?.length > 0) {
        return true;
      }
    }
    
    // Try to find by tenant ID as a last resort
    const response = await fetch(
      `https://services.leadconnectorhq.com/contacts?query=${tenantId}&locationId=${ghlLocationId}`,
      {
        headers: {
          "Authorization": `Bearer ${ghlApiKey}`,
          "Version": "2021-07-28",
          "Content-Type": "application/json"
        }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error looking up contact by tenant ID: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    return data?.contacts?.length > 0;
  } catch (error) {
    console.error(`Error checking if contact exists:`, error instanceof Error ? error.message : String(error));
    return false; // Assume contact doesn't exist if there's an error
  }
}

// Function to create a contact in GoHighLevel
async function createContactInGHL(tenant: Tenant): Promise<string | null> {
  try {
    console.log(`Creating contact for tenant ${tenant.id}: ${tenant.first_name} ${tenant.last_name}`);
    
    if (DRY_RUN) {
      console.log("  [DRY RUN] Skipping actual creation");
      return "dry-run-contact-id";
    }
    
    // Prepare the contact data
    const contactData: any = {
      email: tenant.tenant_email || "",
      firstName: tenant.first_name || "",
      lastName: tenant.last_name || "",
      locationId: ghlLocationId,
      customFields: []
    };
    
    // Add phone if available
    if (tenant.tenant_phone && Array.isArray(tenant.tenant_phone) && tenant.tenant_phone.length > 0) {
      const firstPhone = tenant.tenant_phone[0];
      if (firstPhone) {
        contactData.phone = formatPhoneToE164(firstPhone);
      }
      
      // Add secondary phone if available
      if (tenant.tenant_phone.length > 1 && CUSTOM_FIELD_IDS.SECONDARY_PHONE) {
        const secondPhone = tenant.tenant_phone[1];
        if (secondPhone) {
          contactData.customFields.push({
            id: CUSTOM_FIELD_IDS.SECONDARY_PHONE,
            value: formatPhoneToE164(secondPhone)
          });
        }
      }
    }
    
    // Add tenant ID custom field
    if (CUSTOM_FIELD_IDS.TENANT_ID) {
      contactData.customFields.push({
        id: CUSTOM_FIELD_IDS.TENANT_ID,
        value: String(tenant.id)
      });
    }
    
    // Add rent totals if available
    if (tenant.rent && tenant.check_in_date && CUSTOM_FIELD_IDS.YEARLY_RENT_TOTALS && CUSTOM_FIELD_IDS.TOTAL_LIFETIME_RENT) {
      const year = tenant.check_in_date.substring(0, 4);
      const rent = Number(tenant.rent);
      
      if (year && rent > 0) {
        const yearlyTotals = { [year]: rent };
        
        contactData.customFields.push({
          id: CUSTOM_FIELD_IDS.YEARLY_RENT_TOTALS,
          value: JSON.stringify(yearlyTotals)
        });
        
        contactData.customFields.push({
          id: CUSTOM_FIELD_IDS.TOTAL_LIFETIME_RENT,
          value: String(rent)
        });
      }
    }
    
    // Create the contact
    const response = await fetch(
      "https://services.leadconnectorhq.com/contacts",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ghlApiKey}`,
          "Version": "2021-07-28",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(contactData)
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error creating contact: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`  Successfully created contact with ID: ${data.id}`);
    return data.id;
  } catch (error) {
    console.error(`  Error creating contact:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

// Function to add a note to a contact
async function addNoteToContact(contactId: string, tenant: Tenant): Promise<boolean> {
  try {
    console.log(`Adding note to contact ${contactId}`);
    
    if (DRY_RUN) {
      console.log("  [DRY RUN] Skipping actual note creation");
      return true;
    }
    
    const noteText = `This contact was created by the backfill-missing-contacts.ts script on ${new Date().toISOString()}.\n\n` +
                     `Tenant ID: ${tenant.id}\n` +
                     `Confirmation Number: ${tenant.confirmation_number || "N/A"}\n` +
                     `Check-in Date: ${tenant.check_in_date || "N/A"}\n` +
                     `Rent: ${tenant.rent || "N/A"}`;
    
    const noteData = {
      body: noteText,
      contactId,
      userId: "system",
      locationId: ghlLocationId
    };
    
    const response = await fetch(
      "https://services.leadconnectorhq.com/notes",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ghlApiKey}`,
          "Version": "2021-07-28",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(noteData)
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error adding note: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    console.log(`  Successfully added note to contact ${contactId}`);
    return true;
  } catch (error) {
    console.error(`  Error adding note:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Main function
async function main() {
  console.log("Starting backfill of missing contacts");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Sleep between batches: ${SLEEP_MS}ms`);
  console.log(`Rate limit: ${RATE_LIMIT} contacts per minute`);
  
  try {
    // Fetch tenants from Supabase
    const tenants = await fetchTenantsFromSupabase();
    
    if (tenants.length === 0) {
      console.log("No tenants found in Supabase. Exiting.");
      return;
    }
    
    // Find tenants that don't have corresponding contacts in GHL
    console.log("Checking which tenants don't have contacts in GHL...");
    const missingContacts: Tenant[] = [];
    
    for (const tenant of tenants) {
      const primaryPhone = tenant.tenant_phone && Array.isArray(tenant.tenant_phone) && tenant.tenant_phone.length > 0
        ? formatPhoneToE164(tenant.tenant_phone[0])
        : null;
      
      const exists = await contactExistsInGHL(tenant.tenant_email, primaryPhone, tenant.id);
      
      if (!exists) {
        console.log(`No contact found for tenant ${tenant.id}: ${tenant.first_name} ${tenant.last_name}`);
        missingContacts.push(tenant);
      }
    }
    
    console.log(`Found ${missingContacts.length} tenants without contacts in GHL`);
    
    if (missingContacts.length === 0) {
      console.log("No missing contacts to create. Exiting.");
      return;
    }
    
    // Process missing contacts in batches
    let successCount = 0;
    let failureCount = 0;
    let processedInThisMinute = 0;
    let minuteStartTime = Date.now();
    
    for (let i = 0; i < missingContacts.length; i += BATCH_SIZE) {
      const batch = missingContacts.slice(i, i + BATCH_SIZE);
      console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(missingContacts.length / BATCH_SIZE)} (${batch.length} contacts)`);
      
      for (const tenant of batch) {
        // Check if we need to throttle based on rate limit
        const currentTime = Date.now();
        if (currentTime - minuteStartTime > 60000) {
          // Reset the counter for a new minute
          processedInThisMinute = 0;
          minuteStartTime = currentTime;
        } else if (processedInThisMinute >= RATE_LIMIT) {
          // Wait until the minute is up
          const timeToWait = 60000 - (currentTime - minuteStartTime);
          console.log(`Rate limit of ${RATE_LIMIT} contacts per minute reached. Waiting ${timeToWait}ms...`);
          await sleep(timeToWait);
          processedInThisMinute = 0;
          minuteStartTime = Date.now();
        }
        
        // Create the contact
        const contactId = await createContactInGHL(tenant);
        
        if (contactId) {
          // Add a note to the contact
          const noteSuccess = await addNoteToContact(contactId, tenant);
          
          if (noteSuccess) {
            successCount++;
          } else {
            console.log(`  Note creation failed, but contact was created successfully`);
            successCount++;
          }
        } else {
          failureCount++;
        }
        
        // Increment the rate limit counter
        processedInThisMinute++;
      }
      
      // Sleep between batches to avoid rate limits
      if (i + BATCH_SIZE < missingContacts.length) {
        console.log(`Sleeping for ${SLEEP_MS}ms to avoid rate limits...`);
        await sleep(SLEEP_MS);
      }
    }
    
    // Print summary
    console.log("\n=== Summary ===");
    console.log(`Total missing contacts: ${missingContacts.length}`);
    console.log(`${DRY_RUN ? "Would have created" : "Successfully created"}: ${successCount}`);
    if (failureCount > 0) {
      console.log(`Failed to create: ${failureCount}`);
    }
    
  } catch (error) {
    console.error("Error in main process:", error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

// Run the main function
if (import.meta.main) {
  main();
}