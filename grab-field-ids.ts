// grab-field-ids.ts
// Extract GoHighLevel custom field IDs for sync_leases-ts

// IMPORTANT: This script requires Node.js 18+ for the built-in fetch API
// If using an older Node.js version, install node-fetch:
// npm install node-fetch
// Then modify this script to import fetch

// Check if GHL_API_KEY is set
const API_KEY = process.env.GHL_API_KEY;
if (!API_KEY) {
  console.error("\x1b[33mGHL_API_KEY environment variable not set.\x1b[0m");
  console.error("Please set it before running this script:");
  console.error("export GHL_API_KEY=sk_live_********************************");
  process.exit(1);
}

// Location ID is hardcoded as in the Edge Function
const LOCATION_ID = "v5jAtUx8vmG1ucKOCjA8";

// Custom fields we want to extract (with contact. prefix)
const wanted = new Set([
  "contact.supabase_tenant_id",
  "contact.current_rental_address",
  "contact.current_unit_number",
  "contact.current_owner_name",
  "contact.current_owner_phones_json",
]);

// Main function
(async () => {
  console.log("\x1b[33mFetching custom fields from GoHighLevel API...\x1b[0m");
  
  try {
    const res = await fetch("https://rest.gohighlevel.com/v1/custom-fields", {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        LocationId: LOCATION_ID,
      },
    });

    if (!res.ok) {
      console.error(`\x1b[31mAPI request failed with status ${res.status}\x1b[0m`);
      console.error(await res.text());
      process.exit(1);
    }

    const data = await res.json();
    
    if (!data.customFields || !Array.isArray(data.customFields)) {
      console.error("\x1b[31mError: Unexpected API response format\x1b[0m");
      console.error("Response:", JSON.stringify(data, null, 2));
      process.exit(1);
    }

    // Filter and display the custom fields
    console.log("\n\x1b[32mCustom Field IDs:\x1b[0m");
    const foundFields = data.customFields
      .filter(f => wanted.has(f.fieldKey))
      .map(f => ({
        key: f.fieldKey.replace('contact.', ''), // Remove the contact. prefix
        id: f.id
      }));
    
    if (foundFields.length === 0) {
      console.error("\x1b[31mNo matching custom fields found\x1b[0m");
      process.exit(1);
    }

    // Print each field
    foundFields.forEach(f => {
      console.log(`${f.key}=${f.id}`);
    });

    // Format for Supabase secrets
    console.log("\n\x1b[32mCopy this command to set Supabase secrets:\x1b[0m");
    let secretsCommand = "supabase secrets set \\\n";
    
    foundFields.forEach(f => {
      // Convert to uppercase with CF_ prefix
      const formattedKey = `CF_${f.key.toUpperCase()}`;
      secretsCommand += `  ${formattedKey}=${f.id} \\\n`;
    });
    
    console.log(secretsCommand);
    
    console.log("\n\x1b[33mNote:\x1b[0m If you're using a specific project, add the project reference after logging in:");
    console.log("supabase login");
    console.log("supabase link --project-ref bcuwccyyjgmshslnkpyv");
    console.log("supabase secrets set CF_SUPABASE_TENANT_ID=value [...]");

    // Check if we found all the fields we wanted
    const missingFields = Array.from(wanted).filter(key => 
      !foundFields.some(f => f.key === key)
    );
    
    if (missingFields.length > 0) {
      console.warn("\n\x1b[33mWarning: Some fields were not found:\x1b[0m");
      missingFields.forEach(field => console.warn(`- ${field}`));
    }

  } catch (error) {
    console.error("\x1b[31mError fetching custom fields:\x1b[0m", error);
    process.exit(1);
  }
})();