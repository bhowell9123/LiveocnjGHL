#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * patch-phone-format.ts
 * 
 * This script finds contacts with phone numbers that don't match the E.164 format
 * and updates them to use the correct format (+1XXXXXXXXXX).
 * It handles both primary and secondary phone fields.
 * It also detects and splits concatenated phone numbers.
 * 
 * Usage:
 *   deno run --allow-net --allow-env --allow-read scripts/patch-phone-format.ts [options]
 * 
 * Options:
 *   --dry-run          Run in dry-run mode (no actual updates)
 *   --batch-size=200   Number of contacts to process in each batch (default: 200)
 *   --sleep=2000       Milliseconds to sleep between batches (default: 2000)
 *   --rate=200         Maximum number of contacts to process per minute (default: 200)
 *   --filter="text"    Filter contacts by name (case-insensitive substring match)
 *   --id=1234          Process only the contact with the specified tenant ID
 */

import { parse } from "https://deno.land/std/flags/mod.ts";
import { load } from "https://deno.land/std/dotenv/mod.ts";
import { cleanPhone } from "../lib/utils.ts";
import { isE164, splitAndFormatPhones } from "../lib/phone.ts";

// Load environment variables from .env file
await load({ export: true });

// Parse command line arguments
const args = parse(Deno.args, {
  boolean: ["dry-run"],
  string: ["batch-size", "sleep", "rate", "filter", "id"],
  default: {
    "dry-run": false,
    "batch-size": "200",
    "sleep": "2000",
    "rate": "200",
    "filter": "",
    "id": ""
  }
});

const DRY_RUN = args["dry-run"];
const BATCH_SIZE = parseInt(args["batch-size"], 10);
const SLEEP_MS = parseInt(args["sleep"], 10);
const RATE_LIMIT = parseInt(args["rate"], 10);
const NAME_FILTER = args["filter"] ? args["filter"].toLowerCase() : "";
const TENANT_ID = args["id"] ? args["id"] : "";

// Get environment variables
const ghlApiKey = Deno.env.get("GHL_API_V2_KEY");
const ghlLocationId = Deno.env.get("LOCATION_ID");
const cfSecondaryPhone = Deno.env.get("CF_SECONDARY_PHONE");

if (!ghlApiKey || !ghlLocationId) {
  console.error("Error: GHL_API_V2_KEY or LOCATION_ID environment variables are not set");
  console.log("Please set them in your .env file");
  Deno.exit(1);
}

if (!cfSecondaryPhone) {
  console.error("Error: CF_SECONDARY_PHONE environment variable is not set");
  console.log("This is required to update the secondary phone number");
  Deno.exit(1);
}

// Sleep function to avoid rate limits
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if a phone number is in E.164 format and not a concatenated number
function isE164Format(phone: string): boolean {
  if (!phone) return false;
  
  // First check if it's in E.164 format
  if (!isE164(phone)) return false;
  
  // Then check if it might be a concatenated number
  // For US numbers, a proper E.164 format should be +1 followed by 10 digits (total 12 chars)
  // If it's longer than 12 chars and starts with +1, it might be concatenated
  if (phone.startsWith("+1") && phone.length > 12) {
    return false; // Likely a concatenated number
  }
  
  return true;
}

// Helper function for GHL API calls with proper headers
async function ghlFetchV2(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = {
    "Authorization": `Bearer ${ghlApiKey}`,
    "Version": "2021-07-28",
    "Content-Type": "application/json",
    ...options.headers
  };

  return fetch(url, {
    ...options,
    headers
  });
}

// Function to fetch all contacts from GoHighLevel with pagination
async function fetchAllContacts(): Promise<any[]> {
  console.log("Fetching contacts from GoHighLevel...");
  
  let allContacts: any[] = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    try {
      console.log(`Fetching page ${page}...`);
      
      const response = await ghlFetchV2(
        `https://services.leadconnectorhq.com/contacts?locationId=${ghlLocationId}&limit=100&page=${page}`
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error fetching contacts: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      const contacts = data.contacts || [];
      
      allContacts = allContacts.concat(contacts);
      
      console.log(`Fetched ${contacts.length} contacts from page ${page}`);
      
      hasMore = contacts.length === 100;
      page++;
      
      // Sleep to avoid rate limits
      if (hasMore) {
        await sleep(SLEEP_MS / 2); // Use half the sleep time between pages
      }
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error instanceof Error ? error.message : String(error));
      break;
    }
  }
  
  console.log(`Fetched a total of ${allContacts.length} contacts from GoHighLevel`);
  return allContacts;
}

// Function to build update payload for a contact
const buildUpdates = (c: any) => {
  const [primary, secondary] = splitAndFormatPhones(c.phone ?? "");

  // Skip if nothing to change
  if (primary === c.phone && (!secondary || secondary === c.customFields?.[CF_SECONDARY_PHONE])) {
    return null;
  }

  const payload: any = { phone: primary };
  if (secondary) {
    payload.customField = { [CF_SECONDARY_PHONE]: secondary };
  }
  return payload;
};

// Function to update a contact's phone numbers in GoHighLevel
async function updateContactPhones(
  contactId: string,
  primaryPhone: string | null,
  secondaryPhone: string | null
): Promise<boolean> {
  try {
    console.log(`Updating contact ${contactId}:`);
    console.log(`  Primary phone: ${primaryPhone}`);
    if (secondaryPhone) {
      console.log(`  Secondary phone: ${secondaryPhone}`);
    }
    
    if (DRY_RUN) {
      console.log("  [DRY RUN] Skipping actual update");
      return true;
    }
    
    // Skip if primary phone is null
    if (!primaryPhone) {
      console.warn(`  ⚠️ Skipping update - primary phone is null`);
      return false;
    }
    
    // First, get the current contact data to preserve other fields
    const getResponse = await ghlFetchV2(
      `https://services.leadconnectorhq.com/contacts/${contactId}`
    );
    
    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      throw new Error(`Error getting contact ${contactId}: ${getResponse.status} ${getResponse.statusText} - ${errorText}`);
    }
    
    const contactData = await getResponse.json();
    const contact = contactData.contact;
    
    // Get existing custom fields or initialize empty array
    const customFields = Array.isArray(contact.customFields) ?
      [...contact.customFields] : [];
    
    // Update secondary phone if provided
    if (secondaryPhone) {
      // Find the index of the secondary phone field if it exists
      const secondaryPhoneIndex = customFields.findIndex(field => field.id === cfSecondaryPhone);
      
      // Update or add the secondary phone field
      if (secondaryPhoneIndex >= 0) {
        customFields[secondaryPhoneIndex].value = secondaryPhone;
      } else {
        customFields.push({
          id: cfSecondaryPhone,
          value: secondaryPhone
        });
      }
    }
    
    // Prepare the update payload
    const updatePayload = {
      phone: primaryPhone,
      customFields: customFields
      // locationId is not needed in the update payload and causes a 422 error
    };
    
    // Make the API call to update the contact
    const response = await ghlFetchV2(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        method: "PUT",
        body: JSON.stringify(updatePayload)
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error updating contact ${contactId}: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    console.log(`  ✅ Successfully updated contact ${contactId}`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error updating contact ${contactId}:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Main function
async function main() {
  console.log("Starting phone format patch");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Sleep between batches: ${SLEEP_MS}ms`);
  console.log(`Rate limit: ${RATE_LIMIT} contacts per minute`);
  
  try {
    // Fetch all contacts
    const allContacts = await fetchAllContacts();
    
    // Apply tenant ID filter if specified
    let filteredContacts = allContacts;
    if (TENANT_ID) {
      console.log(`Filtering for tenant ID: ${TENANT_ID}`);
      // Look for tenant ID in custom fields
      filteredContacts = allContacts.filter(contact => {
        if (Array.isArray(contact.customFields)) {
          const tenantIdField = contact.customFields.find((field: any) =>
            field.id === Deno.env.get("CF_SUPABASE_TENANT_ID") && field.value === TENANT_ID
          );
          return !!tenantIdField;
        }
        return false;
      });
      console.log(`Found ${filteredContacts.length} contacts with tenant ID ${TENANT_ID}`);
      
      // Print details of the found contacts
      filteredContacts.forEach(contact => {
        console.log(`Contact: ${contact.firstName} ${contact.lastName} (${contact.id})`);
        console.log(`  Phone: ${contact.phone || "none"}`);
        
        // Check for secondary phone
        if (Array.isArray(contact.customFields)) {
          const secondaryPhoneField = contact.customFields.find((field: any) => field.id === cfSecondaryPhone);
          if (secondaryPhoneField) {
            console.log(`  Secondary Phone: ${secondaryPhoneField.value || "none"}`);
          }
        }
        
        // Test our splitAndFormatPhones function on the current phone
        if (contact.phone) {
          const [primary, secondary] = splitAndFormatPhones(contact.phone);
          console.log(`  Split result: primary=${primary}, secondary=${secondary || "none"}`);
        }
      });
    } else if (NAME_FILTER) {
      console.log(`Filtering contacts by name: "${NAME_FILTER}"`);
      // Filter by name (case-insensitive)
      filteredContacts = allContacts.filter(contact => {
        const fullName = `${contact.firstName || ""} ${contact.lastName || ""}`.toLowerCase();
        return fullName.includes(NAME_FILTER.toLowerCase());
      });
      console.log(`Found ${filteredContacts.length} contacts matching name filter "${NAME_FILTER}"`);
      
      // Print details of the found contacts
      filteredContacts.forEach(contact => {
        console.log(`Contact: ${contact.firstName} ${contact.lastName} (${contact.id})`);
        console.log(`  Phone: ${contact.phone || "none"}`);
        
        // Check for secondary phone
        if (Array.isArray(contact.customFields)) {
          const secondaryPhoneField = contact.customFields.find((field: any) => field.id === cfSecondaryPhone);
          if (secondaryPhoneField) {
            console.log(`  Secondary Phone: ${secondaryPhoneField.value || "none"}`);
          }
        }
        
        // Test our splitAndFormatPhones function on the current phone
        if (contact.phone) {
          const [primary, secondary] = splitAndFormatPhones(contact.phone);
          console.log(`  Split result: primary=${primary}, secondary=${secondary || "none"}`);
        }
      });
    }
    
    // Filter contacts with phone numbers that need fixing
    const contactsToFix = filteredContacts.filter(contact => {
      // Check primary phone
      const needsPrimaryFix = contact.phone && !isE164Format(contact.phone);
      
      // Check secondary phone in custom fields
      let hasSecondaryPhone = false;
      let needsSecondaryFix = false;
      
      if (Array.isArray(contact.customFields)) {
        const secondaryPhoneField = contact.customFields.find((field: any) => field.id === cfSecondaryPhone);
        if (secondaryPhoneField) {
          hasSecondaryPhone = true;
          needsSecondaryFix = !isE164Format(secondaryPhoneField.value);
        }
      }
      
      return needsPrimaryFix || (hasSecondaryPhone && needsSecondaryFix);
    });
    
    console.log(`Found ${contactsToFix.length} contacts with phone numbers that need fixing`);
    
    if (contactsToFix.length === 0) {
      console.log("No contacts need to be fixed. Exiting.");
      return;
    }
    
    // Process contacts in batches
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;
    let processedInThisMinute = 0;
    let minuteStartTime = Date.now();
    
    for (let i = 0; i < contactsToFix.length; i += BATCH_SIZE) {
      const batch = contactsToFix.slice(i, i + BATCH_SIZE);
      console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(contactsToFix.length / BATCH_SIZE)} (${batch.length} contacts)`);
      
      for (const contact of batch) {
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
        
        // Get the current phone numbers
        const currentPrimaryPhone = contact.phone || "";
        console.log(`\nContact: ${contact.firstName} ${contact.lastName} (${contact.id})`);
        console.log(`  Current primary phone: ${currentPrimaryPhone}`);
        
        // Get the secondary phone if it exists
        let currentSecondaryPhone = null;
        if (Array.isArray(contact.customFields)) {
          const secondaryPhoneField = contact.customFields.find((field: any) => field.id === cfSecondaryPhone);
          if (secondaryPhoneField) {
            currentSecondaryPhone = secondaryPhoneField.value;
            console.log(`  Current secondary phone: ${currentSecondaryPhone}`);
          }
        }
        
        // Format the phone numbers to E.164 using the new splitAndFormatPhones function
        const [formattedPrimaryPhone, formattedSecondaryPhone] = currentPrimaryPhone ?
          splitAndFormatPhones(currentPrimaryPhone) : [""];
        
        if (!formattedPrimaryPhone) {
          console.log(`  💤 Skipping contact ${contact.id} - "${currentPrimaryPhone}" not salvageable`);
          skippedCount++;
          continue;
        }
        
        // If we already have a secondary phone in the custom field, only use it if we didn't extract one
        let secondaryPhone = formattedSecondaryPhone;
        if (!secondaryPhone && currentSecondaryPhone) {
          const [formattedCurrentSecondary] = splitAndFormatPhones(currentSecondaryPhone);
          secondaryPhone = formattedCurrentSecondary;
        }
        
        // Only update if the formatted phones are different from the current ones
        if (formattedPrimaryPhone !== currentPrimaryPhone || secondaryPhone !== currentSecondaryPhone) {
          console.log(`  🛠️ Would fix contact ${contact.firstName} ${contact.lastName}`);
          console.log(`   prev: ${currentPrimaryPhone}`);
          console.log(`   new : ${formattedPrimaryPhone}  (secondary ➜ ${secondaryPhone || "none"})`);
          
          // Update the contact
          const success = await updateContactPhones(contact.id, formattedPrimaryPhone, secondaryPhone);
          
          if (success) {
            successCount++;
          } else {
            failureCount++;
          }
          
          // Increment the rate limit counter
          processedInThisMinute++;
        } else {
          console.log(`  No changes needed for this contact`);
        }
      }
      
      // Sleep between batches to avoid rate limits
      if (i + BATCH_SIZE < contactsToFix.length) {
        console.log(`Sleeping for ${SLEEP_MS}ms to avoid rate limits...`);
        await sleep(SLEEP_MS);
      }
    }
    
    // Print summary
    console.log("\n=== Summary ===");
    console.log(`Total contacts processed: ${contactsToFix.length}`);
    console.log(`${DRY_RUN ? "Would have updated" : "Successfully updated"}: ${successCount}`);
    console.log(`Skipped (not salvageable): ${skippedCount}`);
    if (failureCount > 0) {
      console.log(`Failed to update: ${failureCount}`);
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