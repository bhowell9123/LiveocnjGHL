// @ts-nocheck
// add-note-to-contact.ts
// Add a note to a contact in GoHighLevel
// Usage: deno run --allow-net --allow-env --allow-read add-note-to-contact.ts

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

// Contact ID to add a note to (the one with the concatenated phone number)
const contactId = "z3y6hsLnFMmmS7YZiRJw";

// Function to add a note to a contact in GoHighLevel
async function addNoteToContact(contactId: string) {
  try {
    console.log(`Adding note to contact ${contactId}...`);
    
    const noteContent = `PHONE NUMBER ISSUE: This contact has a concatenated phone number (+185678057586097). 
The correct phone numbers are:
- Primary: +1 8567805758 (Caty)
- Secondary: +1 6097744077 (Gail)
This note was added automatically as part of the phone number formatting fix.`;
    
    // Prepare the note payload
    const notePayload = {
      body: noteContent,
      contactId: contactId,
      userId: "system"
    };
    
    console.log("Note payload:", JSON.stringify(notePayload, null, 2));
    
    // Make the API call to add a note to the contact
    const response = await fetch(`https://services.leadconnectorhq.com/notes`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ghlApiKey}`,
        "Version": "2021-07-28",
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(notePayload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error adding note to contact ${contactId}: ${response.status} ${response.statusText} - ${errorText}`);
      return false;
    }
    
    const result = await response.json();
    console.log("Note creation result:", JSON.stringify(result, null, 2));
    console.log(`Successfully added note to contact ${contactId}`);
    return true;
  } catch (error) {
    console.error(`Error adding note to contact ${contactId}: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  console.log("=== Add Note to Contact ===");
  
  // Add a note to the contact
  const success = await addNoteToContact(contactId);
  
  if (success) {
    console.log("Note addition completed successfully");
  } else {
    console.error("Note addition failed");
    Deno.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error("Unhandled error:", error);
  Deno.exit(1);
});