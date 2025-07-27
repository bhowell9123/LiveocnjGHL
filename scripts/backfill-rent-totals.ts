#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * backfill-rent-totals.ts
 * 
 * This script groups tenant rows by email, builds yearly totals and lifetime sums,
 * and updates each matched contact's custom fields in GoHighLevel.
 * 
 * Usage:
 *   deno run --allow-net --allow-env --allow-read scripts/maintenance/backfill-rent-totals.ts [options]
 * 
 * Options:
 *   --dry-run          Run in dry-run mode (no actual updates)
 *   --batch-size=200   Number of contacts to process in each batch (default: 200)
 *   --sleep=2000       Milliseconds to sleep between batches (default: 2000)
 */

import { parse } from "https://deno.land/std/flags/mod.ts";
import { calculateRentTotals, mapCustomFields } from "../../lib/utils.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// Parse command line arguments
const args = parse(Deno.args, {
  boolean: ["dry-run"],
  string: ["batch-size", "sleep"],
  default: {
    "dry-run": false,
    "batch-size": "200",
    "sleep": "2000"
  }
});

const DRY_RUN = args["dry-run"];
const BATCH_SIZE = parseInt(args["batch-size"], 10);
const SLEEP_MS = parseInt(args["sleep"], 10);

// Get environment variables
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ghlApiKey = Deno.env.get("GHL_API_V2_KEY");
const ghlLocationId = Deno.env.get("LOCATION_ID");
const cfYearlyRentTotals = Deno.env.get("CF_YEARLY_RENT_TOTALS");
const cfTotalLifetimeRent = Deno.env.get("CF_TOTAL_LIFETIME_RENT");

// Validate required environment variables
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

if (!cfYearlyRentTotals || !cfTotalLifetimeRent) {
  console.error("Error: CF_YEARLY_RENT_TOTALS or CF_TOTAL_LIFETIME_RENT environment variables are not set");
  console.log("These are required to store the rent totals");
  Deno.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Sleep function to avoid rate limits
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Interface for tenant data
interface Tenant {
  id: number;
  tenant_email: string;
  first_name: string;
  last_name: string;
  rent: number;
  year: string;
  created_at: string;
}

// Interface for grouped tenant data
interface GroupedTenant {
  email: string;
  tenants: Tenant[];
  yearlyTotals: Record<string, number>;
  totalLifetimeRent: number;
}

// Function to fetch tenants from Supabase
async function fetchTenantsFromSupabase(): Promise<Tenant[]> {
  console.log("Fetching tenants from Supabase...");
  
  try {
    const { data, error } = await supabase
      .from("tenants")
      .select("id, tenant_email, first_name, last_name, rent, year, created_at")
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

// Function to group tenants by email and calculate rent totals
function groupTenantsByEmail(tenants: Tenant[]): GroupedTenant[] {
  console.log("Grouping tenants by email and calculating rent totals...");
  
  const emailGroups: Record<string, Tenant[]> = {};
  
  // Group tenants by email
  for (const tenant of tenants) {
    if (!tenant.tenant_email) continue;
    
    const email = tenant.tenant_email.toLowerCase();
    if (!emailGroups[email]) {
      emailGroups[email] = [];
    }
    emailGroups[email].push(tenant);
  }
  
  // Calculate rent totals for each group
  const groupedTenants: GroupedTenant[] = [];
  
  for (const [email, tenantGroup] of Object.entries(emailGroups)) {
    let yearlyTotals: Record<string, number> = {};
    let totalLifetimeRent = 0;
    
    // Calculate rent totals for each tenant in the group
    for (const tenant of tenantGroup) {
      if (!tenant.rent || !tenant.year) continue;
      
      const rent = Number(tenant.rent);
      const year = String(tenant.year);
      
      if (isNaN(rent) || rent <= 0) continue;
      
      const result = calculateRentTotals(rent, year, yearlyTotals);
      yearlyTotals = result.yearlyTotals;
      totalLifetimeRent = result.totalLifetimeRent;
    }
    
    groupedTenants.push({
      email,
      tenants: tenantGroup,
      yearlyTotals,
      totalLifetimeRent
    });
  }
  
  console.log(`Grouped tenants into ${groupedTenants.length} unique email addresses`);
  return groupedTenants;
}

// Function to fetch contacts from GoHighLevel by email
async function fetchContactByEmail(email: string): Promise<any> {
  try {
    const encodedEmail = encodeURIComponent(email);
    
    const response = await fetch(
      `https://services.leadconnectorhq.com/contacts/lookup?email=${encodedEmail}&locationId=${ghlLocationId}`,
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
      throw new Error(`Error fetching contact by email: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    return data?.contacts?.[0] || null;
  } catch (error) {
    console.error(`Error fetching contact by email:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

// Function to update a contact's rent totals in GoHighLevel
async function updateContactRentTotals(
  contactId: string,
  yearlyTotals: Record<string, number>,
  totalLifetimeRent: number
): Promise<boolean> {
  try {
    console.log(`Updating contact ${contactId} with rent totals:`);
    console.log(`  Yearly totals: ${JSON.stringify(yearlyTotals)}`);
    console.log(`  Total lifetime rent: ${totalLifetimeRent}`);
    
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
    
    // Find the indices of the rent totals fields if they exist
    const yearlyTotalsIndex = customFields.findIndex(field => field.id === cfYearlyRentTotals);
    const lifetimeRentIndex = customFields.findIndex(field => field.id === cfTotalLifetimeRent);
    
    // Update or add the yearly rent totals field
    if (yearlyTotalsIndex >= 0) {
      customFields[yearlyTotalsIndex].value = JSON.stringify(yearlyTotals);
    } else {
      customFields.push({
        id: cfYearlyRentTotals,
        value: JSON.stringify(yearlyTotals)
      });
    }
    
    // Update or add the total lifetime rent field
    if (lifetimeRentIndex >= 0) {
      customFields[lifetimeRentIndex].value = String(totalLifetimeRent);
    } else {
      customFields.push({
        id: cfTotalLifetimeRent,
        value: String(totalLifetimeRent)
      });
    }
    
    // Prepare the update payload
    const updatePayload = {
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
  console.log("Starting backfill of rent totals");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Sleep between batches: ${SLEEP_MS}ms`);
  
  try {
    // Fetch tenants from Supabase
    const tenants = await fetchTenantsFromSupabase();
    
    if (tenants.length === 0) {
      console.log("No tenants found in Supabase. Exiting.");
      return;
    }
    
    // Group tenants by email and calculate rent totals
    const groupedTenants = groupTenantsByEmail(tenants);
    
    if (groupedTenants.length === 0) {
      console.log("No grouped tenants to process. Exiting.");
      return;
    }
    
    // Process grouped tenants in batches
    let successCount = 0;
    let failureCount = 0;
    let notFoundCount = 0;
    
    for (let i = 0; i < groupedTenants.length; i += BATCH_SIZE) {
      const batch = groupedTenants.slice(i, i + BATCH_SIZE);
      console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(groupedTenants.length / BATCH_SIZE)} (${batch.length} contacts)`);
      
      for (const group of batch) {
        console.log(`\nProcessing email: ${group.email}`);
        
        // Skip if no yearly totals
        if (Object.keys(group.yearlyTotals).length === 0) {
          console.log(`  No rent data for this email. Skipping.`);
          continue;
        }
        
        // Fetch the contact from GoHighLevel
        const contact = await fetchContactByEmail(group.email);
        
        if (!contact) {
          console.log(`  No contact found in GoHighLevel for email ${group.email}`);
          notFoundCount++;
          continue;
        }
        
        console.log(`  Found contact: ${contact.firstName} ${contact.lastName} (${contact.id})`);
        
        // Update the contact's rent totals
        const success = await updateContactRentTotals(
          contact.id,
          group.yearlyTotals,
          group.totalLifetimeRent
        );
        
        if (success) {
          successCount++;
        } else {
          failureCount++;
        }
      }
      
      // Sleep between batches to avoid rate limits
      if (i + BATCH_SIZE < groupedTenants.length) {
        console.log(`Sleeping for ${SLEEP_MS}ms to avoid rate limits...`);
        await sleep(SLEEP_MS);
      }
    }
    
    // Print summary
    console.log("\n=== Summary ===");
    console.log(`Total grouped tenants: ${groupedTenants.length}`);
    console.log(`Contacts not found in GoHighLevel: ${notFoundCount}`);
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