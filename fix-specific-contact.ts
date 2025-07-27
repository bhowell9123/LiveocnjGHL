// @ts-nocheck
// fix-specific-contact.ts
// Fix a specific contact's phone number in GoHighLevel
// Usage: deno run --allow-net --allow-env --allow-read fix-specific-contact.ts

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

// Contact information for Caty Or Gail Berman
const contactId = "z3y6hsLnFMmmS7YZiRJw";
const primaryPhone = "+1 8567805758";
const secondaryPhone = "+1 6097744077";

// Function to update a contact in GoHighLevel
async function updateContact() {
  try {
    console.log(`Updating contact ${contactId}`);
    console.log(`Primary phone: ${primaryPhone}`);
    console.log(`Secondary phone: ${secondaryPhone}`);
    
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
    
    // Prepare the update payload
    const updatePayload = {
      phone: primaryPhone
    };
    
    // Add secondary phone as a custom field if available
    if (secondaryPhone && cfSecondaryPhone) {
      // Get existing custom fields or initialize empty array
      const customFields = Array.isArray(contactData.customFields) ? 
        contactData.customFields.filter(field => field.id !== cfSecondaryPhone) : [];
      
      // Add secondary phone field
      customFields.push({
        id: cfSecondaryPhone,
        value: secondaryPhone
      });
      
      updatePayload.customFields = customFields;
    }
    
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
    console.log(`Successfully updated contact ${contactId}`);
    return true;
  } catch (error) {
    console.error(`Error updating contact ${contactId}: ${error.message}`);
    return false;
  }
}

// Run the update function
updateContact().then(success => {
  if (success) {
    console.log("Contact update completed successfully");
  } else {
    console.error("Contact update failed");
    Deno.exit(1);
  }
}).catch(error => {
  console.error("Unhandled error:", error);
  Deno.exit(1);
});