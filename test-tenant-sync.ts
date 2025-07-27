// @ts-nocheck
// test-tenant-sync.ts
// Test the updated index.ts phone number formatting with a sample tenant sync
// Usage: deno run --allow-net --allow-env --allow-read test-tenant-sync.ts [--tenant-id=1091]

// Import required modules
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parse } from "https://deno.land/std@0.224.0/flags/mod.ts";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// Load environment variables
const env = await load({ export: true, path: ".env" });

// Parse command line arguments
const args = parse(Deno.args, {
  string: ["tenant-id"],
  default: {
    "tenant-id": "1091" // Default to Caty Berman's ID (the one with the slash in the phone number)
  }
});

const tenantId = args["tenant-id"];

// Create Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are not set");
  console.log("Please set them in your .env file");
  Deno.exit(1);
}

// Get GHL environment variables
const ghlApiKey = Deno.env.get("GHL_API_KEY");
const cfSecondaryPhone = Deno.env.get("CF_SECONDARY_PHONE");

if (!ghlApiKey) {
  console.error("Error: GHL_API_KEY environment variable is not set");
  console.log("Please set it in your .env file");
  Deno.exit(1);
}

console.log("Environment variables loaded successfully");

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to format phone numbers (copied from index.ts)
function formatPhoneNumber(phone: string): string {
  if (!phone) return "";
  
  // Clean the phone number (remove non-digit characters)
  const cleaned = phone.replace(/\D/g, "");
  
  if (cleaned.length === 0) return "";
  
  if (cleaned.length === 10) {
    // US number without country code
    return `+1 ${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
    // US number with country code
    return `+1 ${cleaned.substring(1)}`;
  } else if (cleaned.length > 0) {
    // International number or other format
    // Ensure we only take the first 15 digits to avoid concatenation issues
    const truncated = cleaned.slice(0, 15);
    
    // For international numbers, add a space after the country code
    if (truncated.length >= 10) {
      // Assume 1-digit country code for numbers >= 10 digits
      return `+${truncated.substring(0, 1)} ${truncated.substring(1)}`;
    } else {
      // For shorter numbers, just add the plus
      return `+${truncated}`;
    }
  }
  
  return "";
}

// Main function
async function main() {
  console.log(`=== Test Tenant Sync with Updated Phone Number Formatting ===`);
  console.log(`Tenant ID: ${tenantId}`);
  
  try {
    // Fetch the tenant from Supabase
    console.log("Fetching tenant from Supabase...");
    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", tenantId)
      .single();
    
    if (error) {
      throw new Error(`Error fetching tenant: ${error.message}`);
    }
    
    if (!tenant) {
      throw new Error(`Tenant with ID ${tenantId} not found`);
    }
    
    console.log("Tenant found:");
    console.log(`Name: ${tenant.first_name} ${tenant.last_name}`);
    console.log(`Email: ${tenant.tenant_email}`);
    console.log(`Phone: ${JSON.stringify(tenant.tenant_phone)}`);
    
    // Process the tenant using the same logic as in index.ts
    console.log("\nProcessing tenant phone number...");
    
    // Format the phone number properly
    let primaryPhone = "";
    let secondaryPhone = "";
    
    if (Array.isArray(tenant.tenant_phone) && tenant.tenant_phone.length > 0) {
      // Extract primary phone
      let firstPhone = tenant.tenant_phone[0];
      
      // If the phone contains multiple numbers separated by slash, split them
      if (typeof firstPhone === "string" && firstPhone.includes("/")) {
        const phoneParts = firstPhone.split("/").map((p: string) => p.trim());
        primaryPhone = phoneParts[0];
        if (phoneParts.length > 1) {
          secondaryPhone = phoneParts[1];
        }
      } else {
        primaryPhone = firstPhone;
      }
      
      // Extract secondary phone if available in array
      if (tenant.tenant_phone.length > 1 && !secondaryPhone) {
        secondaryPhone = tenant.tenant_phone[1];
      }
    } else if (typeof tenant.tenant_phone === "string") {
      // If the phone contains multiple numbers separated by slash, split them
      let phoneStr = tenant.tenant_phone;
      if (phoneStr.includes("/")) {
        const phoneParts = phoneStr.split("/").map((p: string) => p.trim());
        primaryPhone = phoneParts[0];
        if (phoneParts.length > 1) {
          secondaryPhone = phoneParts[1];
        }
      } else {
        primaryPhone = phoneStr;
      }
    }
    
    // Format the primary phone number
    const formattedPrimaryPhone = formatPhoneNumber(primaryPhone);
    
    // Format the secondary phone number if available
    let formattedSecondaryPhone = "";
    if (secondaryPhone) {
      formattedSecondaryPhone = formatPhoneNumber(secondaryPhone);
    }
    
    console.log(`Primary Phone: ${primaryPhone} -> ${formattedPrimaryPhone}`);
    if (secondaryPhone) {
      console.log(`Secondary Phone: ${secondaryPhone} -> ${formattedSecondaryPhone}`);
    }
    
    // Create the contact object
    const contact = {
      email: tenant.tenant_email,
      firstName: tenant.first_name,
      lastName: tenant.last_name,
      phone: formattedPrimaryPhone,
      customField: {
        supabase_tenant_id: String(tenant.id),
        current_rental_address: tenant.rental_address,
        current_unit_number: tenant.unit_number,
        current_owner_name: tenant.unit_owner,
        current_owner_phones_json: JSON.stringify(tenant.owner_phone || [])
      }
    };
    
    // Add secondary phone as a custom field if available
    if (formattedSecondaryPhone && cfSecondaryPhone) {
      contact.customField[cfSecondaryPhone] = formattedSecondaryPhone;
    }
    
    console.log("\nContact object to send to GoHighLevel:");
    console.log(JSON.stringify(contact, null, 2));
    
    // Ask for confirmation before sending to GoHighLevel
    console.log("\nDo you want to send this contact to GoHighLevel? (y/n)");
    const confirmation = prompt("Enter y to confirm, any other key to cancel: ");
    
    if (confirmation?.toLowerCase() !== "y") {
      console.log("Operation canceled by user");
      return;
    }
    
    // Send the contact to GoHighLevel
    console.log("\nSending contact to GoHighLevel...");
    const contactResponse = await fetch("https://rest.gohighlevel.com/v1/contacts/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ghlApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(contact)
    });
    
    if (!contactResponse.ok) {
      const errorText = await contactResponse.text();
      throw new Error(`Error sending contact to GoHighLevel: ${contactResponse.status} ${contactResponse.statusText} - ${errorText}`);
    }
    
    const contactResult = await contactResponse.json();
    console.log("\nContact successfully sent to GoHighLevel:");
    console.log(JSON.stringify(contactResult, null, 2));
    
    console.log("\nTest completed successfully!");
    console.log("The contact has been updated in GoHighLevel with properly formatted phone numbers.");
    console.log("You can verify the result by checking the contact in the GoHighLevel interface.");
    
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