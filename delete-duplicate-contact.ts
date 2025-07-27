// @ts-nocheck
// delete-duplicate-contact.ts
// Delete a duplicate contact in GoHighLevel
// Usage: deno run --allow-net --allow-env --allow-read delete-duplicate-contact.ts

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

// Contact ID to delete (the one with the concatenated phone number)
const contactIdToDelete = "z3y6hsLnFMmmS7YZiRJw";

// Function to delete a contact in GoHighLevel
async function deleteContact(contactId: string) {
  try {
    console.log(`Deleting contact ${contactId}...`);
    
    // Make the API call to delete the contact
    const response = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${ghlApiKey}`,
        "Version": "2021-07-28",
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error deleting contact ${contactId}: ${response.status} ${response.statusText} - ${errorText}`);
      return false;
    }
    
    console.log(`Successfully deleted contact ${contactId}`);
    return true;
  } catch (error) {
    console.error(`Error deleting contact ${contactId}: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  console.log("=== Delete Duplicate Contact ===");
  
  // Delete the contact
  const success = await deleteContact(contactIdToDelete);
  
  if (success) {
    console.log("Contact deletion completed successfully");
  } else {
    console.error("Contact deletion failed");
    Deno.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error("Unhandled error:", error);
  Deno.exit(1);
});