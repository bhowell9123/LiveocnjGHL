/**
 * This script reads tenant data from tenant_supabase_examples.md and fetches
 * matching contacts from GoHighLevel API based on email or phone.
 */

// --- load 100-row Supabase sample -------------
const mdContent = await Deno.readTextFile("tenant_supabase_examples.md");
const jsonMatch = mdContent.match(/\[\n\s*\{[\s\S]*\}\n\]/);

if (!jsonMatch) {
  throw new Error("Could not find JSON data in the markdown file");
}

const tenants = JSON.parse(jsonMatch[0]);

// --- helpers ----------------------------------
const GHL_TOKEN = "pit-574b7e96-f306-4838-9860-a7393c7af4e2";
const LOCATION_ID = "v5jAtUx8vmG1ucKOCjA8";

const headers = {
  Authorization: `Bearer ${GHL_TOKEN}`,
  Version: "2021-07-28"
};

// For debugging
console.log(`Using location ID: ${LOCATION_ID}`);
console.log(`Using token: ${GHL_TOKEN.substring(0, 10)}...`);

const buildUrl = (search: string) => {
  const base = "https://services.leadconnectorhq.com/contacts";
  const qp = new URLSearchParams({
    locationId: LOCATION_ID,
    query: search
  });
  return `${base}?${qp.toString()}`;
};

// --- main loop --------------------------------
const results: any[] = [];

for (const t of tenants) {
  const emailTerm = t.tenant_email?.trim();
  const phoneDigits = t.tenant_phone?.[0]?.replace(/\D/g, "");

  if (!emailTerm && !phoneDigits) {
    results.push({ supaId: t.id, error: "no email/phone" });
    continue;
  }

  // Prepare phone with country code for better matching
  const fullPhone = phoneDigits?.length === 10 ? `1${phoneDigits}` : phoneDigits;
  
  // First try with email if available
  if (emailTerm) {
    console.log(`Fetching contact for email: ${emailTerm}`);
    
    try {
      const url = buildUrl(emailTerm);
      const res = await fetch(url, { headers });
      
      if (res.status !== 200) {
        const text = await res.text();
        console.log(`  Error with email search: ${text}`);
        // Don't exit - we'll try phone fallback
      } else {
        const data = await res.json();
        
        // Debug: Log one raw API response to confirm structure
        if (results.length === 0) {
          console.log("Sample API response structure:");
          console.log(JSON.stringify(data, null, 2));
        }
        
        // If we found contacts with email, use them
        if (data.contacts && data.contacts.length > 0) {
          results.push({ supaId: t.id, contacts: data.contacts });
          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));
          continue; // Skip phone search
        }
      }
    } catch (error) {
      console.error(`Error fetching contact for email ${emailTerm}:`, error);
      // Don't exit - we'll try phone fallback
    }
  }
  
  // Fallback to phone search if email failed or returned no results
  if (fullPhone) {
    console.log(`Fetching contact for phone: ${fullPhone}`);
    
    try {
      const url = buildUrl(fullPhone);
      const res = await fetch(url, { headers });
      
      if (res.status !== 200) {
        const text = await res.text();
        results.push({ supaId: t.id, status: res.status, error: text });
      } else {
        const data = await res.json();
        results.push({ supaId: t.id, contacts: data.contacts ?? [] });
      }
    } catch (error) {
      console.error(`Error fetching contact for phone ${fullPhone}:`, error);
      results.push({ 
        supaId: t.id, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  } else if (!results.some(r => r.supaId === t.id)) {
    // If we didn't add a result yet (no email match and no phone to try)
    results.push({ supaId: t.id, contacts: [] });
  }
  
  // Add a small delay to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 300));
}

await Deno.writeTextFile("ghl_contacts_100.json", JSON.stringify(results, null, 2));
console.log("✅ fetched 100 lookups via v2 /contacts");

// Also save the original tenant data for easier comparison
await Deno.writeTextFile(
  "tenant_supabase_examples.json", 
  JSON.stringify(tenants, null, 2)
);
console.log("Tenant data saved to tenant_supabase_examples.json");