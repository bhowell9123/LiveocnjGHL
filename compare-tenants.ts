#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// compare-tenants.ts
// Compare tenants in Supabase with contacts in GoHighLevel to identify discrepancies

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parse } from "https://deno.land/std@0.224.0/flags/mod.ts";
import * as dotenv from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// Load environment variables from .env file
const env = await dotenv.load({ export: true });

// Parse command line arguments
const flags = parse(Deno.args, {
  string: ["limit"],
  default: { limit: "100" },
});

// Constants
const LOCATION_ID = "v5jAtUx8vmG1ucKOCjA8"; // Required for location-level API keys
const SUPABASE_URL = env.SUPABASE_URL || Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GHL_API_KEY = env.GHL_API_KEY || Deno.env.get("GHL_API_KEY");
const CF_SUPABASE_TENANT_ID = env.CF_SUPABASE_TENANT_ID || Deno.env.get("CF_SUPABASE_TENANT_ID");

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_KEY || !GHL_API_KEY || !CF_SUPABASE_TENANT_ID) {
  console.error("Missing required environment variables. Please check your .env file.");
  console.error("Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GHL_API_KEY, CF_SUPABASE_TENANT_ID");
  Deno.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Function to fetch tenants from Supabase
async function fetchTenantsFromSupabase(limit: number): Promise<any[]> {
  console.log(`Fetching up to ${limit} tenants from Supabase...`);
  
  const { data: tenants, error } = await supabase
    .from("tenants")
    .select("id, first_name, last_name, tenant_email, created_at, last_scraped_at")
    .order("id", { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error("Error fetching tenants from Supabase:", error.message);
    Deno.exit(1);
  }
  
  console.log(`Retrieved ${tenants?.length || 0} tenants from Supabase`);
  return tenants || [];
}

// Function to fetch all contacts from GoHighLevel (paginated)
async function fetchAllContactsFromGHL(): Promise<any[]> {
  console.log("Fetching contacts from GoHighLevel...");
  
  const allContacts: any[] = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    try {
      const response = await fetch(`https://rest.gohighlevel.com/v1/contacts/?page=${page}&limit=100`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${GHL_API_KEY}`,
          "Content-Type": "application/json",
          "LocationId": LOCATION_ID
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error fetching contacts from GHL (page ${page}):`, response.status, errorText);
        break;
      }
      
      const data = await response.json();
      const contacts = data.contacts || [];
      
      if (contacts.length === 0) {
        hasMore = false;
      } else {
        allContacts.push(...contacts);
        console.log(`Retrieved ${contacts.length} contacts from page ${page}`);
        page++;
      }
    } catch (error) {
      console.error(`Error fetching contacts from GHL (page ${page}):`, error.message);
      break;
    }
  }
  
  console.log(`Retrieved a total of ${allContacts.length} contacts from GoHighLevel`);
  return allContacts;
}

// Function to extract tenant ID from GHL contact custom fields
function getTenantIdFromContact(contact: any): string | null {
  if (!contact.customField) return null;
  
  // If customField is an array (newer format)
  if (Array.isArray(contact.customField)) {
    const tenantIdField = contact.customField.find((field: any) => field.id === CF_SUPABASE_TENANT_ID);
    return tenantIdField?.value || null;
  }
  
  // If customField is an object (older format)
  if (typeof contact.customField === 'object') {
    // Find the property that corresponds to the tenant ID
    for (const [key, value] of Object.entries(contact.customField)) {
      if (key === 'tenant_id' || key.includes('tenant')) {
        return String(value);
      }
    }
  }
  
  return null;
}

// Main function
async function main() {
  try {
    // Parse limit from command line arguments
    const limit = parseInt(flags.limit, 10);
    
    // Fetch data from both systems
    const supabaseTenants = await fetchTenantsFromSupabase(limit);
    const ghlContacts = await fetchAllContactsFromGHL();
    
    // Create a map of GHL contacts by tenant ID
    const ghlContactsByTenantId = new Map();
    
    for (const contact of ghlContacts) {
      const tenantId = getTenantIdFromContact(contact);
      if (tenantId) {
        ghlContactsByTenantId.set(tenantId, contact);
      }
    }
    
    console.log(`Found ${ghlContactsByTenantId.size} GHL contacts with tenant IDs`);
    
    // Find tenants that exist in Supabase but not in GHL
    const missingInGHL = supabaseTenants.filter(tenant => !ghlContactsByTenantId.has(String(tenant.id)));
    
    console.log("\n=== COMPARISON RESULTS ===");
    console.log(`Total Supabase tenants: ${supabaseTenants.length}`);
    console.log(`Total GHL contacts with tenant IDs: ${ghlContactsByTenantId.size}`);
    console.log(`Tenants missing in GHL: ${missingInGHL.length}`);
    
    if (missingInGHL.length > 0) {
      console.log("\nTenants in Supabase that are missing in GoHighLevel:");
      console.log("ID | Name | Email | Created At");
      console.log("---|------|-------|----------");
      
      for (const tenant of missingInGHL) {
        console.log(`${tenant.id} | ${tenant.first_name} ${tenant.last_name} | ${tenant.tenant_email} | ${tenant.created_at}`);
      }
      
      console.log("\nTo sync these missing tenants, run:");
      console.log("curl -X POST \"https://bcuwccyyjgmshslnkpyv.functions.supabase.co/sync_leases-ts\" \\");
      console.log("  -H \"Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY\" \\");
      console.log("  -d '{}'");
    } else {
      console.log("\nAll tenants in Supabase exist in GoHighLevel! 🎉");
    }
    
  } catch (error) {
    console.error("Error in main function:", error.message);
    Deno.exit(1);
  }
}

// Run the main function
main();