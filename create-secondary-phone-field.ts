// @ts-nocheck
// create-secondary-phone-field.ts
// Create a custom field in GoHighLevel for secondary phone numbers and retrieve its ID
// Usage: deno run --allow-net --allow-env --allow-read create-secondary-phone-field.ts

// Import required modules
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// Load environment variables
const env = await load({ export: true, path: ".env" });

// Get environment variables
const ghlApiKey = Deno.env.get("GHL_API_KEY"); // Using v1 API key
const ghlLocationId = Deno.env.get("LOCATION_ID");

if (!ghlApiKey || !ghlLocationId) {
  console.error("Error: GHL_API_KEY or LOCATION_ID environment variables are not set");
  console.log("Please set them in your .env file");
  Deno.exit(1);
}

console.log("Environment variables loaded successfully");

// Main function
async function main() {
  console.log("=== Create Secondary Phone Custom Field in GoHighLevel ===");
  
  try {
    // First, check if a custom field for secondary phone already exists
    console.log("Checking if a custom field for secondary phone already exists...");
    
    const getFieldsResponse = await fetch("https://rest.gohighlevel.com/v1/custom-fields", {
      headers: {
        "Authorization": `Bearer ${ghlApiKey}`,
        "LocationId": ghlLocationId,
        "Accept": "application/json"
      }
    });
    
    if (!getFieldsResponse.ok) {
      const errorText = await getFieldsResponse.text();
      throw new Error(`Error fetching custom fields: ${getFieldsResponse.status} ${getFieldsResponse.statusText} - ${errorText}`);
    }
    
    const data = await getFieldsResponse.json();
    console.log(`Found ${data.customFields?.length || 0} custom fields`);
    
    // Print all custom fields for debugging
    console.log("\nAll custom fields:");
    data.customFields?.forEach((field, index) => {
      console.log(`${index + 1}. ${field.name} (ID: ${field.id}, Type: ${field.dataType || field.type})`);
    });
    
    // Check if a secondary phone field already exists
    const secondaryPhoneField = data.customFields?.find(field =>
      field.name.toLowerCase().includes("secondary") && field.name.toLowerCase().includes("phone")
    );
    
    if (secondaryPhoneField) {
      console.log(`\nSecondary phone field already exists with ID: ${secondaryPhoneField.id}`);
      console.log(`Field name: ${secondaryPhoneField.name}`);
      console.log(`Field type: ${secondaryPhoneField.dataType || secondaryPhoneField.type}`);
      
      console.log("\nTo update your .env file, add or modify this line:");
      console.log(`CF_SECONDARY_PHONE=${secondaryPhoneField.id}`);
      
      return;
    }
    
    // Create a new custom field for secondary phone
    console.log("Creating a new custom field for secondary phone...");
    
    const createFieldResponse = await fetch("https://rest.gohighlevel.com/v1/custom-fields", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ghlApiKey}`,
        "LocationId": ghlLocationId,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        name: "Secondary Phone",
        dataType: "PHONE",
        placeholder: "Enter secondary phone number",
        description: "Secondary phone number for the contact"
      })
    });
    
    if (!createFieldResponse.ok) {
      const errorText = await createFieldResponse.text();
      throw new Error(`Error creating custom field: ${createFieldResponse.status} ${createFieldResponse.statusText} - ${errorText}`);
    }
    
    const newField = await createFieldResponse.json();
    console.log("Response from create field API:");
    console.log(JSON.stringify(newField, null, 2));
    
    // Extract the ID from the response
    const fieldId = newField.id || newField.customField?.id;
    
    console.log(`\nSuccessfully created secondary phone field with ID: ${fieldId}`);
    
    console.log("\nTo update your .env file, add or modify this line:");
    console.log(`CF_SECONDARY_PHONE=${fieldId}`);
    
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