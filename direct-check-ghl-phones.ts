// @ts-nocheck
// direct-check-ghl-phones.ts
// Directly check GoHighLevel contacts for phone number formatting issues
// Usage: deno run --allow-net --allow-env --allow-read --allow-write direct-check-ghl-phones.ts [--output=ghl-formatting-issues.json]

// Import required modules
import { parse } from "https://deno.land/std@0.224.0/flags/mod.ts";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// Load environment variables
const env = await load({ export: true, path: ".env" });

// Parse command line arguments
const args = parse(Deno.args, {
  string: ["output"],
  default: {
    "output": "ghl-formatting-issues.json"
  }
});

const outputFile = args["output"];

// Get environment variables
const ghlApiKey = Deno.env.get("GHL_API_V2_KEY");
const ghlLocationId = Deno.env.get("LOCATION_ID");

if (!ghlApiKey || !ghlLocationId) {
  console.error("Error: GHL_API_V2_KEY or LOCATION_ID environment variables are not set");
  console.log("Please set them in your .env file");
  Deno.exit(1);
}

console.log("Environment variables loaded successfully");

// Helper function to clean phone numbers
function cleanPhoneNumber(phone: string): string {
  if (!phone) return "";
  // Remove all non-digit characters
  return phone.replace(/\D/g, "");
}

// Helper function to check if a phone number has formatting issues
function hasPhoneFormattingIssues(phone: string): boolean {
  if (!phone) return false;
  
  const cleaned = cleanPhoneNumber(phone);
  
  // Case 1: Extremely long numbers (likely concatenated)
  if (cleaned.length > 15) {
    console.log(`Phone issue: Number too long (${cleaned.length} digits)`);
    return true;
  }
  
  // Case 2: Numbers that are too short (missing country code or digits)
  if (cleaned.length < 10) {
    console.log(`Phone issue: Number too short (${cleaned.length} digits)`);
    return true;
  }
  
  // Case 3: Detect specific known issues
  const knownIssues = [
    "908581895590880",  // Betsy Taylor
    "610462161626730",
    "215540090521580",
    "856780575860977",  // Caty Or Gail Berman
    "1908581895590880", // Another format of Betsy's number
    "48 43903812"       // Dan Bernstein
  ];
  
  for (const issue of knownIssues) {
    if (phone.includes(issue)) {
      console.log(`Phone issue: Known concatenated number pattern detected (${issue})`);
      return true;
    }
  }
  
  // Case 4: Check for duplicate patterns that indicate concatenation
  if (cleaned.length >= 14) {
    // Look for repeating patterns
    for (let i = 4; i <= 10; i++) {
      const pattern = cleaned.substring(0, i);
      if (cleaned.indexOf(pattern, i) > 0) {
        console.log(`Phone issue: Repeating pattern detected (${pattern})`);
        return true;
      }
    }
  }
  
  // Case 5: Check for unusual formats like "+55 51234567" (missing digits)
  if (phone.includes(" ") && cleaned.length < 11) {
    console.log(`Phone issue: Unusual format with spaces and too few digits`);
    return true;
  }
  
  // Case 6: Check for US numbers without proper spacing after country code
  if (phone.startsWith("+1") && !phone.startsWith("+1 ") && cleaned.length >= 11) {
    // US number without space after country code
    console.log(`Phone issue: Missing space after country code (+1)`);
    return true;
  }
  
  // Case 7: Check for international numbers without proper spacing after country code
  if (phone.startsWith("+") && !phone.includes(" ") && cleaned.length >= 10) {
    // Check if it's not a properly formatted US number
    if (!(phone.startsWith("+1 ") && cleaned.length === 11)) {
      console.log(`Phone issue: International number missing space after country code`);
      return true;
    }
  }
  
  return false;
}

// Helper function to format phone numbers correctly
function formatPhoneNumber(phone: string): string {
  const cleaned = cleanPhoneNumber(phone);
  if (cleaned.length === 0) return "";
  
  // Standard phone number formatting:
  // - If it's 10 digits (US number without country code), add +1 with space
  // - If it's 11 digits and starts with 1 (US number with country code), add + with space
  // - Otherwise, add + and ensure max 15 digits with proper spacing
  
  let formatted = "";
  if (cleaned.length === 10) {
    // US number without country code
    formatted = `+1 ${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
    // US number with country code
    const nationalNumber = cleaned.substring(1);
    formatted = `+1 ${nationalNumber}`;
  } else {
    // International number
    // Ensure we only take the first 15 digits to avoid concatenation issues
    const truncated = cleaned.slice(0, 15);
    
    // For international numbers, try to determine country code (1-3 digits)
    // and add a space after it
    if (truncated.length >= 10) {
      // Assume 1-digit country code for numbers >= 10 digits
      const countryCode = truncated.substring(0, 1);
      const nationalNumber = truncated.substring(1);
      formatted = `+${countryCode} ${nationalNumber}`;
    } else {
      // For shorter numbers, just add the plus
      formatted = `+${truncated}`;
    }
  }
  
  return formatted;
}

// Main function
async function main() {
  console.log("=== Direct Check GoHighLevel Phone Number Formatting Issues ===");
  console.log(`Output file: ${outputFile}`);
  
  try {
    // Fetch all contacts from GoHighLevel
    console.log("Fetching contacts from GoHighLevel...");
    
    let allContacts = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const response = await fetch(`https://services.leadconnectorhq.com/contacts?locationId=${ghlLocationId}&limit=100&page=${page}`, {
        headers: {
          "Authorization": `Bearer ${ghlApiKey}`,
          "Version": "2021-07-28",
          "Accept": "application/json"
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error fetching contacts from GoHighLevel: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      const contacts = data.contacts || [];
      
      allContacts = allContacts.concat(contacts);
      
      console.log(`Fetched ${contacts.length} contacts from page ${page}`);
      
      hasMore = contacts.length === 100;
      page++;
      
      // Add a small delay to avoid rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`Fetched a total of ${allContacts.length} contacts from GoHighLevel`);
    
    // Check for phone number formatting issues
    console.log("Checking for phone number formatting issues...");
    
    const formattingIssues = [];
    
    for (const contact of allContacts) {
      // Skip contacts without a phone number
      if (!contact.phone) {
        continue;
      }
      
      // Check if the phone number has formatting issues
      if (hasPhoneFormattingIssues(contact.phone)) {
        // Use our improved formatPhoneNumber function to get the expected format
        const expectedPhone = formatPhoneNumber(contact.phone);
        
        formattingIssues.push({
          contactId: contact.id,
          contactName: `${contact.firstName || ""} ${contact.lastName || ""}`.trim(),
          contactPhone: contact.phone,
          expectedPhone: expectedPhone
        });
      }
    }
    
    // Sort formatting issues by contact name for easier reading
    formattingIssues.sort((a, b) => a.contactName.localeCompare(b.contactName));
    
    console.log(`Found ${formattingIssues.length} contacts with phone number formatting issues`);
    
    // Print a summary of the issues found
    if (formattingIssues.length > 0) {
      console.log("\nSummary of formatting issues:");
      console.log("-----------------------------");
      formattingIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.contactName}`);
        console.log(`   Current GHL phone: ${issue.contactPhone}`);
        console.log(`   Suggested fix: ${issue.expectedPhone}`);
        console.log("-----------------------------");
      });
    }
    
    // Write the formatting issues to the output file
    await Deno.writeTextFile(outputFile, JSON.stringify(formattingIssues, null, 2));
    
    console.log(`Formatting issues written to ${outputFile}`);
    
    if (formattingIssues.length > 0) {
      console.log("\nTo fix these formatting issues, run:");
      console.log("deno run --allow-net --allow-env --allow-read direct-fix-phone-formatting.ts --input=" + outputFile);
      console.log("\nTo see what changes would be made without applying them, run:");
      console.log("deno run --allow-net --allow-env --allow-read direct-fix-phone-formatting.ts --dry-run --input=" + outputFile);
    } else {
      console.log("\nNo formatting issues found. No action needed.");
    }
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