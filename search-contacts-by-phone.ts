// @ts-nocheck
// search-contacts-by-phone.ts
// Search for contacts with a specific phone number in GoHighLevel
// Usage: deno run --allow-net --allow-env --allow-read search-contacts-by-phone.ts

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

// Phone numbers to search for
const phoneNumbers = [
  "+1 8567805758",
  "8567805758",
  "+18567805758",
  "+1 6097744077",
  "6097744077",
  "+16097744077",
  "+185678057586097"
];

// Function to search for contacts by phone number
async function searchContactsByPhone(phoneNumber: string) {
  try {
    console.log(`Searching for contacts with phone number: ${phoneNumber}`);
    
    // URL encode the phone number
    const encodedPhone = encodeURIComponent(phoneNumber);
    
    // Make the API call to search for contacts
    const response = await fetch(`https://services.leadconnectorhq.com/contacts?query=${encodedPhone}&locationId=${ghlLocationId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${ghlApiKey}`,
        "Version": "2021-07-28",
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error searching for contacts: ${response.status} ${response.statusText} - ${errorText}`);
      return [];
    }
    
    const result = await response.json();
    const contacts = result.contacts || [];
    
    console.log(`Found ${contacts.length} contacts with phone number ${phoneNumber}`);
    
    if (contacts.length > 0) {
      console.log("Contact details:");
      contacts.forEach((contact, index) => {
        console.log(`\nContact ${index + 1}:`);
        console.log(`ID: ${contact.id}`);
        console.log(`Name: ${contact.firstName} ${contact.lastName}`);
        console.log(`Email: ${contact.email}`);
        console.log(`Phone: ${contact.phone}`);
        console.log(`Date Added: ${contact.dateAdded}`);
        console.log(`Custom Fields: ${JSON.stringify(contact.customFields || [])}`);
      });
    }
    
    return contacts;
  } catch (error) {
    console.error(`Error searching for contacts: ${error.message}`);
    return [];
  }
}

// Main function
async function main() {
  console.log("=== Search Contacts by Phone Number ===");
  
  let foundAny = false;
  
  // Search for each phone number
  for (const phoneNumber of phoneNumbers) {
    const contacts = await searchContactsByPhone(phoneNumber);
    if (contacts.length > 0) {
      foundAny = true;
    }
    
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  if (!foundAny) {
    console.log("No contacts found with any of the specified phone numbers.");
  }
}

// Run the main function
main().catch(error => {
  console.error("Unhandled error:", error);
  Deno.exit(1);
});