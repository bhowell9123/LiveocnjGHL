#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * patch-phone-format.ts
 * 
 * This script finds contacts with phone numbers that don't match the E.164 format
 * and updates them to use the correct format (+1XXXXXXXXXX).
 * It handles both primary and secondary phone fields.
 * 
 * Usage:
 *   deno run --allow-net --allow-env --allow-read scripts/patch-phone-format.ts [options]
 * 
 * Options:
 *   --dry-run          Run in dry-run mode (no actual updates)
 *   --batch-size=200   Number of contacts to process in each batch (default: 200)
 *   --sleep=2000       Milliseconds to sleep between batches (default: 2000)
 *   --rate=200         Maximum number of contacts to process per minute (default: 200)
 */

import { parse } from "https://deno.land/std/flags/mod.ts";
import { cleanPhone } from "../lib/utils.ts";

// Parse command line arguments
const args = parse(Deno.args, {
  boolean: ["dry-run"],
  string: ["batch-size", "sleep", "rate"],
  default: {
    "dry-run": false,
    "batch-size": "200",
    "sleep": "2000",
    "rate": "200"
  }
});

const DRY_RUN = args["dry-run"];
const BATCH_SIZE = parseInt(args["batch-size"], 10);
const SLEEP_MS = parseInt(args["sleep"], 10);
const RATE_LIMIT = parseInt(args["rate"], 10);

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

// Check if a phone number is in E.164 format
function isE164Format(phone: string): boolean {
  if (!phone) return false;
  
  // E.164 format: + followed by 1-15 digits
  return /^\+\d{10,15}$/.test(phone);
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
      
      const response = await fetch(
        `https://services.leadconnectorhq.com/contacts?locationId=${ghlLocationId}&limit=100&page=${page}`,
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

// Function to update a contact's phone numbers in GoHighLevel
async function updateContactPhones(
  contactId: string,
  primaryPhone: string,
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
    
    // First, get the current contact data to preserve other fields
    const getResponse = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${ghlApiKey}`,
          "Version": "2021-07-28",
          "Content-Type": "application/json"
        }
      }
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
      customFields: customFields,
      locationId: ghlLocationId
    };
    
    // Make the API call to update the contact
    const response = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${ghlApiKey}`,
          "Version": "2021-07-28",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updatePayload)
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error updating contact ${contactId}: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    console.log(`  Successfully updated contact ${contactId}`);
    return true;
  } catch (error) {
    console.error(`  Error updating contact ${contactId}:`, error instanceof Error ? error.message : String(error));
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
    
    // Filter contacts with phone numbers that need fixing
    const contactsToFix = allContacts.filter(contact => {
      // Check primary phone
      const needsPrimaryFix = contact.phone && !isE164Format(contact.phone);
      
      // Check secondary phone in custom fields
      let hasSecondaryPhone = false;
      let needsSecondaryFix = false;
      
      if (Array.isArray(contact.customFields)) {
        const secondaryPhoneField = contact.customFields.find(field => field.id === cfSecondaryPhone);
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
          const secondaryPhoneField = contact.customFields.find(field => field.id === cfSecondaryPhone);
          if (secondaryPhoneField) {
            currentSecondaryPhone = secondaryPhoneField.value;
            console.log(`  Current secondary phone: ${currentSecondaryPhone}`);
          }
        }
        
        // Format the phone numbers to E.164
        const formattedPrimaryPhone = currentPrimaryPhone ? formatPhoneToE164(currentPrimaryPhone) : "";
        const formattedSecondaryPhone = currentSecondaryPhone ? formatPhoneToE164(currentSecondaryPhone) : null;
        
        // Only update if the formatted phones are different from the current ones
        if (formattedPrimaryPhone !== currentPrimaryPhone || formattedSecondaryPhone !== currentSecondaryPhone) {
          console.log(`  Formatted primary phone: ${formattedPrimaryPhone}`);
          if (formattedSecondaryPhone) {
            console.log(`  Formatted secondary phone: ${formattedSecondaryPhone}`);
          }
          
          // Update the contact
          const success = await updateContactPhones(contact.id, formattedPrimaryPhone, formattedSecondaryPhone);
          
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