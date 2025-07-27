#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * create-missing-opps.ts
 * 
 * This script finds contacts in GHL that don't have any opportunities (opportunityCount === 0)
 * and creates opportunities for them with the appropriate stage based on the check-in date.
 * 
 * Usage:
 *   deno run --allow-net --allow-env --allow-read scripts/create-missing-opps.ts [options]
 * 
 * Options:
 *   --dry-run          Run in dry-run mode (no actual updates)
 *   --batch-size=200   Number of contacts to process in each batch (default: 200)
 *   --sleep=2000       Milliseconds to sleep between batches (default: 2000)
 *   --rate=150         Maximum number of contacts to process per minute (default: 150)
 */

import { parse } from "https://deno.land/std/flags/mod.ts";

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
const ghlApiKey = Deno.env.get("GHL_API_V2_KEY");
const ghlLocationId = Deno.env.get("LOCATION_ID") || "v5jAtUx8vmG1ucKOCjA8";
const ghlPipelineId = Deno.env.get("GHL_PIPELINE_ID");

// Get stage IDs
const STAGES = {
  NEW_INQUIRY: Deno.env.get("STAGE_NEW_INQUIRY_ID"),
  NEEDS_SEARCH: Deno.env.get("STAGE_NEEDS_SEARCH_ID"),
  SEARCH_SENT: Deno.env.get("STAGE_SEARCH_SENT_ID"),
  BOOKED_2025: Deno.env.get("STAGE_BOOKED_2025_ID"),
  BOOKED_2026: Deno.env.get("STAGE_BOOKED_2026_ID"),
  PAST_GUEST: Deno.env.get("STAGE_PAST_GUEST_ID")
};

// Custom field IDs
const CUSTOM_FIELD_IDS = {
  TENANT_ID: Deno.env.get("CF_SUPABASE_TENANT_ID"),
  YEARLY_RENT_TOTALS: Deno.env.get("CF_YEARLY_RENT_TOTALS_JSON"),
  TOTAL_LIFETIME_RENT: Deno.env.get("CF_TOTAL_LIFETIME_RENT")
};

// Validate required environment variables
if (!ghlApiKey) {
  console.error("Error: GHL_API_V2_KEY environment variable is not set");
  console.log("Please set it in your .env file");
  Deno.exit(1);
}

if (!ghlPipelineId) {
  console.error("Error: GHL_PIPELINE_ID environment variable is not set");
  console.log("Please set it in your .env file");
  Deno.exit(1);
}

// Validate stage IDs
const missingStages = Object.entries(STAGES)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingStages.length > 0) {
  console.error(`Error: Missing stage IDs: ${missingStages.join(", ")}`);
  console.log("Please set them in your .env file");
  Deno.exit(1);
}

// Sleep function to avoid rate limits
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to fetch contacts from GoHighLevel with pagination
async function fetchContactsWithNoOpportunities(): Promise<any[]> {
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
      
      // Filter contacts with no opportunities
      const contactsWithNoOpps = contacts.filter(contact => 
        contact.opportunityCount === 0 || contact.opportunityCount === "0"
      );
      
      allContacts = allContacts.concat(contactsWithNoOpps);
      
      console.log(`Fetched ${contacts.length} contacts from page ${page}, ${contactsWithNoOpps.length} have no opportunities`);
      
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
  
  console.log(`Found a total of ${allContacts.length} contacts with no opportunities`);
  return allContacts;
}

// Function to get contact details including custom fields
async function getContactDetails(contactId: string): Promise<any> {
  try {
    const response = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
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
      throw new Error(`Error getting contact details: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    return data.contact;
  } catch (error) {
    console.error(`Error getting contact details:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

// Function to determine the appropriate stage based on custom fields
function determineStage(contact: any): string {
  // Default to PAST_GUEST if we can't determine a better stage
  let stageId = STAGES.PAST_GUEST;
  
  // Try to extract year from yearly rent totals
  let year = null;
  if (contact.customFields) {
    const yearlyRentTotalsField = Array.isArray(contact.customFields) 
      ? contact.customFields.find(field => field.id === CUSTOM_FIELD_IDS.YEARLY_RENT_TOTALS)
      : null;
    
    if (yearlyRentTotalsField && yearlyRentTotalsField.value) {
      try {
        const yearlyTotals = JSON.parse(yearlyRentTotalsField.value);
        // Get the most recent year
        const years = Object.keys(yearlyTotals).map(Number).sort((a, b) => b - a);
        if (years.length > 0) {
          year = String(years[0]);
        }
      } catch (error) {
        console.error(`Error parsing yearly rent totals:`, error instanceof Error ? error.message : String(error));
      }
    }
  }
  
  // Determine stage based on year
  if (year) {
    if (year === "2026") stageId = STAGES.BOOKED_2026;
    else if (year === "2025") stageId = STAGES.BOOKED_2025;
    else if (Number(year) < 2025) stageId = STAGES.PAST_GUEST;
  }
  
  return stageId;
}

// Function to determine monetary value from custom fields
function determineMonetaryValue(contact: any): number {
  // Default to 0 if we can't determine a better value
  let monetaryValue = 0;
  
  // Try to extract total lifetime rent
  if (contact.customFields) {
    const totalLifetimeRentField = Array.isArray(contact.customFields)
      ? contact.customFields.find(field => field.id === CUSTOM_FIELD_IDS.TOTAL_LIFETIME_RENT)
      : null;
    
    if (totalLifetimeRentField && totalLifetimeRentField.value) {
      const value = Number(totalLifetimeRentField.value);
      if (!isNaN(value)) {
        monetaryValue = value;
      }
    }
    
    // If no total lifetime rent, try to sum yearly rent totals
    if (monetaryValue === 0) {
      const yearlyRentTotalsField = Array.isArray(contact.customFields)
        ? contact.customFields.find(field => field.id === CUSTOM_FIELD_IDS.YEARLY_RENT_TOTALS)
        : null;
      
      if (yearlyRentTotalsField && yearlyRentTotalsField.value) {
        try {
          const yearlyTotals = JSON.parse(yearlyRentTotalsField.value);
          monetaryValue = Object.values(yearlyTotals).reduce((sum: number, value: any) => sum + Number(value), 0);
        } catch (error) {
          console.error(`Error parsing yearly rent totals:`, error instanceof Error ? error.message : String(error));
        }
      }
    }
  }
  
  return monetaryValue;
}

// Function to create an opportunity for a contact
async function createOpportunity(contact: any): Promise<boolean> {
  try {
    console.log(`Creating opportunity for contact ${contact.id}: ${contact.firstName} ${contact.lastName}`);
    
    // Get detailed contact info to access custom fields
    const contactDetails = await getContactDetails(contact.id);
    if (!contactDetails) {
      console.error(`  Could not get contact details, skipping opportunity creation`);
      return false;
    }
    
    // Determine stage and monetary value
    const stageId = determineStage(contactDetails);
    const monetaryValue = determineMonetaryValue(contactDetails);
    
    // Get tenant ID for external ID
    let externalId = `contact-${contact.id}`;
    if (contactDetails.customFields && CUSTOM_FIELD_IDS.TENANT_ID) {
      const tenantIdField = Array.isArray(contactDetails.customFields)
        ? contactDetails.customFields.find(field => field.id === CUSTOM_FIELD_IDS.TENANT_ID)
        : null;
      
      if (tenantIdField && tenantIdField.value) {
        externalId = `tenant-${tenantIdField.value}`;
      }
    }
    
    console.log(`  Stage: ${stageId}`);
    console.log(`  Monetary Value: ${monetaryValue}`);
    console.log(`  External ID: ${externalId}`);
    
    if (DRY_RUN) {
      console.log("  [DRY RUN] Skipping actual creation");
      return true;
    }
    
    // Create the opportunity
    const opportunityData = {
      externalId,
      name: `${contact.firstName} ${contact.lastName}`,
      pipelineId: ghlPipelineId,
      stageId,
      status: "open",
      monetaryValue,
      contactId: contact.id,
      locationId: ghlLocationId
    };
    
    const response = await fetch(
      "https://services.leadconnectorhq.com/opportunities",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ghlApiKey}`,
          "Version": "2021-07-28",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(opportunityData)
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error creating opportunity: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    console.log(`  Successfully created opportunity for contact ${contact.id}`);
    return true;
  } catch (error) {
    console.error(`  Error creating opportunity:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Main function
async function main() {
  console.log("Starting creation of missing opportunities");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Sleep between batches: ${SLEEP_MS}ms`);
  console.log(`Rate limit: ${RATE_LIMIT} operations per minute`);
  
  try {
    // Fetch contacts with no opportunities
    const contactsWithNoOpps = await fetchContactsWithNoOpportunities();
    
    if (contactsWithNoOpps.length === 0) {
      console.log("No contacts without opportunities found. Exiting.");
      return;
    }
    
    // Process contacts in batches
    let successCount = 0;
    let failureCount = 0;
    let processedInThisMinute = 0;
    let minuteStartTime = Date.now();
    
    for (let i = 0; i < contactsWithNoOpps.length; i += BATCH_SIZE) {
      const batch = contactsWithNoOpps.slice(i, i + BATCH_SIZE);
      console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(contactsWithNoOpps.length / BATCH_SIZE)} (${batch.length} contacts)`);
      
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
          console.log(`Rate limit of ${RATE_LIMIT} operations per minute reached. Waiting ${timeToWait}ms...`);
          await sleep(timeToWait);
          processedInThisMinute = 0;
          minuteStartTime = Date.now();
        }
        
        // Create opportunity for the contact
        const success = await createOpportunity(contact);
        
        if (success) {
          successCount++;
        } else {
          failureCount++;
        }
        
        // Increment the rate limit counter
        processedInThisMinute++;
      }
      
      // Sleep between batches to avoid rate limits
      if (i + BATCH_SIZE < contactsWithNoOpps.length) {
        console.log(`Sleeping for ${SLEEP_MS}ms to avoid rate limits...`);
        await sleep(SLEEP_MS);
      }
    }
    
    // Print summary
    console.log("\n=== Summary ===");
    console.log(`Total contacts without opportunities: ${contactsWithNoOpps.length}`);
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