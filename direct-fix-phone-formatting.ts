// @ts-nocheck
// direct-fix-phone-formatting.ts
// Directly fix phone number formatting issues in GoHighLevel contacts
// Usage: deno run --allow-net --allow-env --allow-read direct-fix-phone-formatting.ts [--dry-run] [--input=formatting-issues.json]

// Import required modules
import { parse } from "https://deno.land/std@0.224.0/flags/mod.ts";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// Load environment variables
const env = await load({ export: true, path: ".env" });

// Parse command line arguments
const args = parse(Deno.args, {
  boolean: ["dry-run"],
  string: ["input"],
  default: {
    "dry-run": false,
    "input": "formatting-issues.json"
  }
});

const dryRun = args["dry-run"];
const inputFile = args["input"];

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

// Helper function to clean phone numbers
function cleanPhoneNumber(phone: string): string {
  if (!phone) return "";
  // Remove all non-digit characters
  return phone.replace(/\D/g, "");
}

// Helper function to format phone numbers
function formatPhoneNumber(phone: string): string {
  // If the phone contains multiple numbers separated by slash, take only the first one
  if (phone.includes("/")) {
    phone = phone.split("/")[0].trim();
  }
  
  let cleaned = cleanPhoneNumber(phone);
  if (cleaned.length === 0) return "";
  
  // Standard phone number formatting with proper spacing:
  // - If it's 10 digits (US number without country code), add +1 with space
  // - If it's 11 digits and starts with 1 (US number with country code), add + with space
  // - Otherwise, add + and ensure max 15 digits with proper spacing
  
  let formatted;
  if (cleaned.length === 10) {
    // US number without country code
    formatted = `+1 ${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
    // US number with country code
    const nationalNumber = cleaned.substring(1);
    formatted = `+1 ${nationalNumber}`;
  } else if (cleaned.length > 10) {
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
  } else {
    // For shorter numbers (less than 10 digits), just add the plus
    formatted = `+${cleaned}`;
  }
  
  return formatted;
}

// Function to update a contact in GoHighLevel
async function updateContactInGHL(contactId: string, phoneNumber: string, secondaryPhone: string = ""): Promise<boolean> {
  try {
    // Prepare the update payload - do NOT include locationId for updates
    const updatePayload: any = {
      phone: phoneNumber
    };
    
    // Add secondary phone as a custom field if available
    if (secondaryPhone && cfSecondaryPhone) {
      updatePayload.customFields = [
        {
          id: cfSecondaryPhone,
          value: secondaryPhone
        }
      ];
    }
    
    console.log(`Updating contact ${contactId} with phone: ${phoneNumber}`);
    if (secondaryPhone) {
      console.log(`Adding secondary phone: ${secondaryPhone}`);
    }
    
    if (dryRun) {
      console.log("[DRY RUN] Would send update payload:", JSON.stringify(updatePayload));
      return true;
    }
    
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
    
    console.log(`Successfully updated contact ${contactId}`);
    return true;
  } catch (error) {
    console.error(`Error updating contact ${contactId}: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  console.log("=== Direct Fix Phone Number Formatting Issues ===");
  console.log(`Dry run: ${dryRun ? "Yes (no changes will be made)" : "No (changes will be applied)"}`);
  console.log(`Input file: ${inputFile}`);

  try {
    // Read the formatting issues from the input file
    const formattingIssuesText = await Deno.readTextFile(inputFile);
    const formattingIssues = JSON.parse(formattingIssuesText);

    console.log(`Found ${formattingIssues.length} formatting issues to fix`);

    if (formattingIssues.length === 0) {
      console.log("No formatting issues to fix. Exiting.");
      return;
    }

    // Process each formatting issue
    let successCount = 0;
    let failureCount = 0;

    for (const issue of formattingIssues) {
      // Use the expected phone from the issue report
      const formattedPhone = issue.expectedPhone;
      
      // Get secondary phone if available
      let secondaryPhone = "";
      if (issue.tenantPhone && issue.tenantPhone.includes("/")) {
        const phoneParts = issue.tenantPhone.split("/").map(p => p.trim());
        if (phoneParts.length > 1) {
          secondaryPhone = formatPhoneNumber(phoneParts[1]);
        }
      }
      
      console.log(`Processing contact ${issue.contactId} (${issue.contactName}):`);
      console.log(`  Current phone: ${issue.contactPhone}`);
      console.log(`  New phone: ${formattedPhone}`);
      if (secondaryPhone) {
        console.log(`  Secondary phone: ${secondaryPhone}`);
      }
      
      // Update the contact in GoHighLevel
      const success = await updateContactInGHL(issue.contactId, formattedPhone, secondaryPhone);
      
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\nSummary:`);
    console.log(`${dryRun ? "[DRY RUN] Would have updated" : "Successfully updated"} ${successCount} contacts`);
    if (failureCount > 0) {
      console.log(`Failed to update ${failureCount} contacts`);
    }
    
    if (dryRun) {
      console.log("\nThis was a dry run. No changes were made.");
      console.log("To apply the changes, run the script without the --dry-run flag:");
      console.log("deno run --allow-net --allow-env --allow-read direct-fix-phone-formatting.ts");
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.error(`Error: Input file '${inputFile}' not found`);
      console.log("Please run check-phone-formatting.ts first to generate the formatting-issues.json file");
    } else {
      console.error(`Error: ${error.message}`);
    }
    Deno.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error("Unhandled error:", error);
  Deno.exit(1);
});