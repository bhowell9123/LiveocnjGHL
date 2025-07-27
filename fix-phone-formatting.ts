// @ts-nocheck
// fix-phone-formatting.ts
// Fix phone number formatting issues by updating tenants in Supabase
// Usage: deno run --allow-net --allow-env --allow-read fix-phone-formatting.ts [--dry-run] [--input=formatting-issues.json]

// Import required modules
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parse } from "https://deno.land/std@0.224.0/flags/mod.ts";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// Load environment variables
const env = await load({ export: true, path: ".env" });

// Parse command line arguments
const args = parse(Deno.args, {
  boolean: ["dry-run"],
  string: ["input"],
  default: {
    "dry-run": false,
    "input": "formatting-issues.json"
  }
});

const dryRun = args["dry-run"];
const inputFile = args["input"];

// Create Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ghlApiKey = Deno.env.get("GHL_API_V2_KEY"); // Using V2 API key instead of V1
const ghlLocationId = Deno.env.get("LOCATION_ID"); // Using LOCATION_ID instead of GHL_LOCATION_ID
const cfSupabaseTenantId = Deno.env.get("CF_SUPABASE_TENANT_ID"); // Custom field ID for tenant_id

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

// Main function
async function main() {
  console.log("=== Fix Phone Number Formatting Issues ===");
  console.log(`Dry run: ${dryRun ? "Yes (no changes will be made)" : "No (changes will be applied)"}`);
  console.log(`Input file: ${inputFile}`);

  try {
    // Read the formatting issues from the input file
    const formattingIssuesText = await Deno.readTextFile(inputFile);
    const formattingIssues = JSON.parse(formattingIssuesText);

    console.log(`Found ${formattingIssues.length} formatting issues to fix`);

    if (formattingIssues.length === 0) {
      console.log("No formatting issues to fix. Exiting.");
      return;
    }

    // Extract tenant IDs from the formatting issues
    const tenantIDs = formattingIssues.map((issue: any) => issue.tenantID);
    console.log(`Tenant IDs to update: ${tenantIDs.join(", ")}`);

    // Update the tenants in batches to avoid hitting API limits
    const batchSize = 100;
    const batches: string[][] = [];

    for (let i = 0; i < tenantIDs.length; i += batchSize) {
      batches.push(tenantIDs.slice(i, i + batchSize));
    }

    console.log(`Updating tenants in ${batches.length} batches of up to ${batchSize} tenants each`);

    let totalUpdated = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1} of ${batches.length} (${batch.length} tenants)`);

      if (!dryRun) {
        // Update the last_scraped_at field for the tenants in this batch
        const { data, error } = await supabase
          .from("tenants")
          .update({ last_scraped_at: new Date().toISOString() })
          .in("id", batch);

        if (error) {
          console.error(`Error updating tenants in batch ${i + 1}: ${error.message}`);
        } else {
          console.log(`Updated ${batch.length} tenants in batch ${i + 1}`);
          totalUpdated += batch.length;
        }
      } else {
        console.log(`[DRY RUN] Would update ${batch.length} tenants in batch ${i + 1}`);
        totalUpdated += batch.length;
      }
    }

    console.log(`${dryRun ? "[DRY RUN] Would update" : "Successfully updated"} ${totalUpdated} tenants`);

    if (!dryRun) {
      console.log("\nThe tenants have been updated with a new last_scraped_at timestamp.");
      console.log("This will trigger the sync process the next time the sync_leases-ts function runs.");
      console.log("You can manually trigger the sync by running:");
      console.log(`curl -X POST "https://bcuwccyyjgmshslnkpyv.functions.supabase.co/sync_leases-ts" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -d '{}'`);
    } else {
      console.log("\nThis was a dry run. No changes were made.");
      console.log("To apply the changes, run the script without the --dry-run flag:");
      console.log("deno run --allow-net --allow-env --allow-read fix-phone-formatting.ts");
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.error(`Error: Input file '${inputFile}' not found`);
      console.log("Please run check-phone-formatting.ts first to generate the formatting-issues.json file");
    } else {
      console.error(`Error: ${error.message}`);
    }
    Deno.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error("Unhandled error:", error);
  Deno.exit(1);
});