/**
 * This script compares tenant data from Supabase with contact data from GoHighLevel
 * to identify any discrepancies in phone numbers, rent fields, and opportunities.
 */

// Define the report structure
interface Report {
  missing: string[];
  phoneMismatch: Array<{key: string; supa: string; ghl: string}>;
  rentMissing: string[];
  oppMissing: string[];
}

const main = async () => {
  try {
    // Load the source data (Supabase tenants)
    const srcData = JSON.parse(await Deno.readTextFile("tenant_supabase_examples.json"));
    
    // Load the GHL contact data
    const ghlData = JSON.parse(await Deno.readTextFile("ghl_contacts_100.json"));
    
    console.log(`Loaded ${srcData.length} tenant records and ${ghlData.length} GHL contacts`);
    
    // Initialize the report
    const report: Report = { 
      missing: [], 
      phoneMismatch: [], 
      rentMissing: [], 
      oppMissing: [] 
    };
    
    // Get environment variables for custom field IDs
    const CF_TOTAL_LIFETIME_RENT = Deno.env.get("CF_TOTAL_LIFETIME_RENT");
    
    if (!CF_TOTAL_LIFETIME_RENT) {
      console.warn("Warning: CF_TOTAL_LIFETIME_RENT environment variable is not set");
    }
    
    // Compare each tenant record with its corresponding GHL contact
    for (const row of srcData) {
      // Use email or phone as the lookup key
      const key = row.tenant_email || row.tenant_phone[0];
      
      // Find matching contact in GHL data
      const ghlEntry = ghlData.find((entry: any) => entry.supaId === row.id);
      
      // If no GHL entry found or contacts array is empty, add to missing list
      if (!ghlEntry || !ghlEntry.contacts || ghlEntry.contacts.length === 0) {
        report.missing.push(key);
        continue;
      }
      
      // Get the first contact from the contacts array
      const contact = ghlEntry.contacts[0];
      
      // Check phone number
      if (row.tenant_phone && row.tenant_phone[0] && contact.phone) {
        const supaPhone = row.tenant_phone[0].replace(/\D/g, "").slice(-10);
        const ghlPhone = contact.phone.replace(/\D/g, "").slice(-10);
        
        if (supaPhone !== ghlPhone) {
          report.phoneMismatch.push({
            key,
            supa: row.tenant_phone[0],
            ghl: contact.phone
          });
        }
      }
      
      // Check rent custom fields
      if (CF_TOTAL_LIFETIME_RENT && contact.customFields) {
        const rentField = contact.customFields.find((f: any) => f.id === CF_TOTAL_LIFETIME_RENT);
        if (!rentField || Number(rentField.value) === 0) {
          report.rentMissing.push(key);
        }
      }
      
      // Check opportunity
      if (!contact.opportunityCount || contact.opportunityCount === 0) {
        report.oppMissing.push(key);
      }
    }
    
    // Print the report
    console.log(JSON.stringify(report, null, 2));
    
    // Save the report to a file
    await Deno.writeTextFile(
      "sync_validation_report.json", 
      JSON.stringify(report, null, 2)
    );
    
    console.log("Validation report saved to sync_validation_report.json");
    
    // Print summary
    console.log("\nSummary:");
    console.log(`- Missing contacts: ${report.missing.length}`);
    console.log(`- Phone mismatches: ${report.phoneMismatch.length}`);
    console.log(`- Missing rent fields: ${report.rentMissing.length}`);
    console.log(`- Missing opportunities: ${report.oppMissing.length}`);
    
    // Provide interpretation guidance
    console.log("\nInterpretation & Fix Recommendations:");
    console.log("Bucket\tWhat it means\tFirst fix to try");
    console.log("missing\tlookup failed or POST 409\tadd phone-fallback lookup and PATCH-on-409 in upsertContactV2");
    console.log("phoneMismatch\tbad formatting\tdump payload before POST; ensure cleanPhone() returns +1XXXXXXXXXX");
    console.log("rentMissing\twrong field IDs or mapper bug\tverify IDs in Supabase secrets, log body.customFields");
    console.log("oppMissing\topportunity 404 or bad pipeline/stage IDs\tcURL the v2 endpoint with current pipelineId & stageId");
    
  } catch (error) {
    console.error("Error:", error);
    Deno.exit(1);
  }
};

main();