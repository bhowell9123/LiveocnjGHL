// @ts-nocheck
// query-supabase.ts
// Execute SQL query against Supabase to find specific contacts
// Usage: deno run --allow-net --allow-env --allow-read query-supabase.ts [--query=query-specific-contacts.sql]

// Import required modules
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parse } from "https://deno.land/std@0.224.0/flags/mod.ts";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// Load environment variables
const env = await load({ export: true, path: ".env" });

// Parse command line arguments
const args = parse(Deno.args, {
  string: ["query"],
  default: {
    "query": "query-specific-contacts.sql"
  }
});

const queryFile = args["query"];

// Create Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are not set");
  console.log("Please set them in your .env file");
  Deno.exit(1);
}

console.log("Environment variables loaded successfully");

const supabase = createClient(supabaseUrl, supabaseKey);

// Main function
async function main() {
  console.log(`=== Execute SQL Query Against Supabase ===`);
  console.log(`Query file: ${queryFile}`);
  
  try {
    // Read the SQL query from the file
    const sqlQuery = await Deno.readTextFile(queryFile);
    console.log("SQL Query:");
    console.log(sqlQuery);
    
    // Execute the query
    console.log("\nExecuting query...");
    const { data, error } = await supabase.rpc('execute_sql', { sql_query: sqlQuery });
    
    if (error) {
      throw new Error(`Error executing query: ${error.message}`);
    }
    
    // Display the results
    console.log("\nQuery Results:");
    if (data && data.length > 0) {
      console.log(`Found ${data.length} contacts:`);
      
      // Display each contact
      data.forEach((contact, index) => {
        console.log(`\nContact #${index + 1}:`);
        console.log("-------------------");
        
        // Display all fields
        for (const [key, value] of Object.entries(contact)) {
          if (key === 'tenant_phone') {
            console.log(`${key}:`);
            if (Array.isArray(value)) {
              value.forEach((phone, i) => {
                console.log(`  [${i}]: ${phone}`);
              });
            } else {
              console.log(`  ${value}`);
            }
          } else {
            console.log(`${key}: ${value}`);
          }
        }
      });
      
      // Save the results to a JSON file
      const outputFile = "query-results.json";
      await Deno.writeTextFile(outputFile, JSON.stringify(data, null, 2));
      console.log(`\nResults saved to ${outputFile}`);
    } else {
      console.log("No contacts found matching the criteria");
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.error(`Error: Query file '${queryFile}' not found`);
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