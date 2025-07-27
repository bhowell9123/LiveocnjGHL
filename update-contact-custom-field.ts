// @ts-nocheck
// update-contact-custom-field.ts
// Update a custom field on a contact in GoHighLevel
// Usage: deno run --allow-net --allow-env --allow-read update-contact-custom-field.ts

// Import required modules
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// Load environment variables
const env = await load({ export: true, path: ".env" });

// Get environment variables
const ghlApiKey = Deno.env.get("GHL_API_V2_KEY");
const ghlLocationId = Deno.env.get("LOCATION_ID");
const cfSecondaryPhone = Deno.env.get("CF_SECONDARY_PHONE");

if (!ghlApiKey || !ghlLocationId) {
  console.error("Error: GHL_API_V2_KEY or LOCATION_ID environment variables are not set");
  console.log("Please set them in your .env file");
  Deno.exit(1);
}

console.log("Environment variables loaded successfully");

// Contact ID to update (the one with the concatenated phone number)
const contactId = "z3y6hsLnFMmmS7YZiRJw";

// Function to update a custom field on a contact in GoHighLevel
async function updateContactCustomField(contactId: string) {
  try {
    console.log(`Updating custom field on contact ${contactId}...`);
    
    // First, get the current contact data
    const getResponse = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${ghlApiKey}`,
        "Version": "2021-07-28",
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    });
    
    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      console.error(`Error getting contact ${contactId}: ${getResponse.status} ${getResponse.statusText} - ${errorText}`);
      return false;
    }
    
    const contactData = await getResponse.json();
    console.log("Current contact data:", JSON.stringify(contactData, null, 2));
    
    // Get existing custom fields or initialize empty array
    const customFields = Array.isArray(contactData.contact.customFields) ? 
      [...contactData.contact.customFields] : [];
    
    // Add secondary phone field
    if (cfSecondaryPhone) {
      // Check if the field already exists
      const existingFieldIndex = customFields.findIndex(field => field.id === cfSecondaryPhone);
      
      if (existingFieldIndex >= 0) {
        // Update existing field
        customFields[existingFieldIndex].value = "+1 6097744077 (Note: This contact has a concatenated phone number issue)";
      } else {
        // Add new field
        customFields.push({
          id: cfSecondaryPhone,
          value: "+1 6097744077 (Note: This contact has a concatenated phone number issue)"
        });
      }
    }
    
    // Prepare the update payload
    const updatePayload = {
      customFields: customFields
    };
    
    console.log("Update payload:", JSON.stringify(updatePayload, null, 2));
    
    // Make the API call to update the contact
    const response = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${ghlApiKey}`,
        "Version": "2021-07-28",
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(updatePayload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error updating contact ${contactId}: ${response.status} ${response.statusText} - ${errorText}`);
      return false;
    }
    
    const result = await response.json();
    console.log("Update result:", JSON.stringify(result, null, 2));
    console.log(`Successfully updated custom field on contact ${contactId}`);
    return true;
  } catch (error) {
    console.error(`Error updating contact ${contactId}: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  console.log("=== Update Contact Custom Field ===");
  
  // Update the contact custom field
  const success = await updateContactCustomField(contactId);
  
  if (success) {
    console.log("Custom field update completed successfully");
  } else {
    console.error("Custom field update failed");
    Deno.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error("Unhandled error:", error);
  Deno.exit(1);
});