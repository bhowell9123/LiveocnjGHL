// @ts-nocheck
// update-contact-name.ts
// Update the name of a contact in GoHighLevel to indicate a phone number issue
// Usage: deno run --allow-net --allow-env --allow-read update-contact-name.ts

// Import required modules
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// Load environment variables
const env = await load({ export: true, path: ".env" });

// Get environment variables
const ghlApiKey = Deno.env.get("GHL_API_V2_KEY");
const ghlLocationId = Deno.env.get("LOCATION_ID");

if (!ghlApiKey || !ghlLocationId) {
  console.error("Error: GHL_API_V2_KEY or LOCATION_ID environment variables are not set");
  console.log("Please set them in your .env file");
  Deno.exit(1);
}

console.log("Environment variables loaded successfully");

// Contact ID to update (the one with the concatenated phone number)
const contactId = "z3y6hsLnFMmmS7YZiRJw";

// Function to update the name of a contact in GoHighLevel
async function updateContactName(contactId: string) {
  try {
    console.log(`Updating name of contact ${contactId}...`);
    
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
      firstName: "Caty Or Gail [PHONE ISSUE]",
      lastName: "Berman"
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
    console.log(`Successfully updated name of contact ${contactId}`);
    return true;
  } catch (error) {
    console.error(`Error updating contact ${contactId}: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  console.log("=== Update Contact Name ===");
  
  // Update the contact name
  const success = await updateContactName(contactId);
  
  if (success) {
    console.log("Contact name update completed successfully");
  } else {
    console.error("Contact name update failed");
    Deno.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error("Unhandled error:", error);
  Deno.exit(1);
});