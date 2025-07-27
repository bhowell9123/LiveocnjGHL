// verify-ghl-contacts.ts
// Check if specific contacts exist in GoHighLevel
// Usage: deno run --allow-net --allow-env verify-ghl-contacts.ts [email1] [email2] ...

// Import required modules
import { parse } from "https://deno.land/std@0.224.0/flags/mod.ts";

// Constants
const LOCATION_ID = "v5jAtUx8vmG1ucKOCjA8"; // Same as in the main function

// Get API key from environment variable
const GHL_API_KEY = Deno.env.get("GHL_API_KEY");
if (!GHL_API_KEY) {
  console.error("Error: GHL_API_KEY environment variable is not set");
  console.log("Please set it with: export GHL_API_KEY=your_api_key");
  Deno.exit(1);
}

// Parse command line arguments
const args = parse(Deno.args);
const emails = args._;

if (emails.length === 0) {
  console.log("Usage: deno run --allow-net --allow-env verify-ghl-contacts.ts [email1] [email2] ...");
  console.log("Example: deno run --allow-net --allow-env verify-ghl-contacts.ts emily.johnson@example.com");
  Deno.exit(0);
}

// Function to check if a contact exists in GoHighLevel
async function checkContact(email: string): Promise<any> {
  try {
    console.log(`Checking if contact with email ${email} exists in GoHighLevel...`);
    
    // First, log the exact request we're making
    console.log(`Request URL: https://rest.gohighlevel.com/v1/contacts/?email=${encodeURIComponent(email)}`);
    
    const response = await fetch(`https://rest.gohighlevel.com/v1/contacts/?email=${encodeURIComponent(email)}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${GHL_API_KEY}`,
        "Content-Type": "application/json",
        "LocationId": LOCATION_ID
      }
    });
    
    if (!response.ok) {
      console.error(`Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`Response: ${errorText}`);
      return { exists: false, error: `${response.status} ${response.statusText}` };
    }
    
    // Log the full response for debugging
    const responseText = await response.text();
    console.log(`Full response: ${responseText}`);
    
    // Parse the response again since we consumed it with text()
    const data = JSON.parse(responseText);
    console.log(`Parsed data:`, JSON.stringify(data, null, 2));
    
    const contacts = data.contacts || [];
    console.log(`Found ${contacts.length} contacts`);
    
    // Check if any of the contacts have the exact email we're looking for
    const exactMatch = contacts.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
    
    if (exactMatch) {
      return {
        exists: true,
        contact: exactMatch,
        customFields: exactMatch.customField || {}
      };
    } else if (contacts.length > 0) {
      // If we found contacts but none match exactly, log a warning
      console.log(`Warning: Found ${contacts.length} contacts but none match the email ${email} exactly`);
      console.log(`First contact email: ${contacts[0].email}`);
      return {
        exists: false,
        warning: `Found ${contacts.length} contacts but none match the email exactly`,
        firstContactEmail: contacts[0].email
      };
    } else {
      return { exists: false };
    }
  } catch (error) {
    console.error(`Error checking contact: ${error.message}`);
    return { exists: false, error: error.message };
  }
}

// Main function
async function main() {
  console.log("GoHighLevel Contact Verification Tool");
  console.log("=====================================");
  
  const results = [];
  
  for (const email of emails) {
    const result = await checkContact(email);
    results.push({ email, ...result });
    
    if (result.exists) {
      console.log(`✅ Contact with email ${email} EXISTS in GoHighLevel`);
      console.log(`   Name: ${result.contact.firstName} ${result.contact.lastName}`);
      console.log(`   Email: ${result.contact.email}`);
      console.log(`   ID: ${result.contact.id}`);
      
      // Display custom fields if they exist
      if (result.contact.customField && Object.keys(result.contact.customField).length > 0) {
        console.log("   Custom Fields:");
        for (const [key, value] of Object.entries(result.contact.customField)) {
          console.log(`     - ${key}: ${value}`);
        }
      }
    } else {
      console.log(`❌ Contact with email ${email} DOES NOT EXIST in GoHighLevel`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      if (result.warning) {
        console.log(`   Warning: ${result.warning}`);
        console.log(`   First contact email found: ${result.firstContactEmail}`);
      }
    }
    
    console.log("-------------------------------------");
  }
  
  // Summary
  console.log("\nSummary:");
  console.log(`Total contacts checked: ${results.length}`);
  console.log(`Contacts found: ${results.filter(r => r.exists).length}`);
  console.log(`Contacts not found: ${results.filter(r => !r.exists).length}`);
}

// Run the main function
main().catch(error => {
  console.error("Unhandled error:", error);
  Deno.exit(1);
});