// supabase/functions/sync_leases.ts
// ──────────────────────────────────────────────────────────────────────────────
//  Sync NEW / UPDATED rows in  public.tenants  ➜  GoHighLevel Contacts & Opps
// ──────────────────────────────────────────────────────────────────────────────
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Validate critical environment variables
const criticalEnvVars = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GHL_API_KEY",
  "GHL_PIPELINE_ID"
];

// ──────────────────────────── Supabase (service-role) ─────────────────────────
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supa = createClient(supabaseUrl, supabaseKey);

// ─────────────────────────────── GHL constants ───────────────────────────────
const GHL = {
  KEY: Deno.env.get("GHL_API_KEY"),
  PIPELINE: Deno.env.get("GHL_PIPELINE_ID"),
  STAGES: {
    NEW_INQUIRY: Deno.env.get("STAGE_NEW_INQUIRY_ID"),
    NEEDS_SEARCH: Deno.env.get("STAGE_NEEDS_SEARCH_ID"),
    SEARCH_SENT: Deno.env.get("STAGE_SEARCH_SENT_ID"),
    BOOKED_2025: Deno.env.get("STAGE_BOOKED_2025_ID"),
    BOOKED_2026: Deno.env.get("STAGE_BOOKED_2026_ID"),
    PAST_GUEST: Deno.env.get("STAGE_PAST_GUEST_ID")
  }
};

// match Supabase user_uuid → GHL user_id (safer implementation)
const OWNERS: Record<string, string> = {};
const brandonUuid = Deno.env.get("SUPA_BRANDON_UUID");
const brandonUserId = Deno.env.get("GHL_BRANDON_USER_ID");
if (brandonUuid && brandonUserId) {
  OWNERS[brandonUuid] = brandonUserId;
}

const cassidyUuid = Deno.env.get("SUPA_CASSIDY_UUID");
const cassidyUserId = Deno.env.get("GHL_CASSIDY_USER_ID");
if (cassidyUuid && cassidyUserId) {
  OWNERS[cassidyUuid] = cassidyUserId;
}

// ─────────────────────────────── HTTP handler ────────────────────────────────
serve(async () => {
  // Validate critical environment variables
  const missingCriticalVars = criticalEnvVars.filter(varName => !Deno.env.get(varName));
  if (missingCriticalVars.length > 0) {
    console.error(`Missing critical environment variables: ${missingCriticalVars.join(', ')}`);
    return new Response(`Configuration error: Missing critical environment variables`, {
      status: 500
    });
  }

  try {
    // 1️⃣ checkpoint (first run falls back to 2000-01-01)
    const { data: ckpt, error: ckptError } = await supa.from("sync_state").select("last_run_at").eq("id", "ghl_lease_sync").single();
    
    if (ckptError) {
      console.error("Error fetching checkpoint:", ckptError.message);
      return new Response("Error fetching checkpoint", { status: 500 });
    }
    
    const sinceISO = new Date(ckpt?.last_run_at ?? "2000-01-01T00:00:00Z").toISOString();
    console.log("⏱ since", sinceISO);
    
    // 2️⃣ pull tenants created OR updated after checkpoint
    const { data: leases, error } = await supa.from("tenants").select("*").or(`created_at.gte.${sinceISO},last_scraped_at.gte.${sinceISO}`).order("created_at", {
      ascending: true
    });
    
    console.log("📝 rows", leases?.length ?? 0, "error", error?.message ?? "none");
    
    if (error) {
      return new Response("Supabase read failed: " + error.message, {
        status: 500
      });
    }
    
    if (!leases?.length) {
      return new Response("No new tenants", {
        status: 200
      });
    }
    
    // Track successfully processed tenants
    const processedTenants = [];
    
    // 3️⃣ iterate over new / changed tenants
    for (const r of leases) {
      try {
        // Format the phone number properly
        let primaryPhone = "";
        let secondaryPhone = "";
        
        if (Array.isArray(r.tenant_phone) && r.tenant_phone.length > 0) {
          // Extract primary phone
          let firstPhone = r.tenant_phone[0];
          
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
          if (r.tenant_phone.length > 1 && !secondaryPhone) {
            secondaryPhone = r.tenant_phone[1];
          }
        } else if (typeof r.tenant_phone === "string") {
          // If the phone contains multiple numbers separated by slash, split them
          let phoneStr = r.tenant_phone;
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
        
        // Format the primary phone number with proper spacing
        if (primaryPhone) {
          // Clean the phone number (remove non-digit characters)
          const cleaned = primaryPhone.replace(/\D/g, "");
          
          if (cleaned.length === 10) {
            // US number without country code
            primaryPhone = `+1 ${cleaned}`;
          } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
            // US number with country code
            primaryPhone = `+1 ${cleaned.substring(1)}`;
          } else if (cleaned.length > 0) {
            // International number or other format
            // Ensure we only take the first 15 digits to avoid concatenation issues
            const truncated = cleaned.slice(0, 15);
            
            // For international numbers, add a space after the country code
            if (truncated.length >= 10) {
              // Assume 1-digit country code for numbers >= 10 digits
              primaryPhone = `+${truncated.substring(0, 1)} ${truncated.substring(1)}`;
            } else {
              // For shorter numbers, just add the plus
              primaryPhone = `+${truncated}`;
            }
          }
        }
        
        // Define contact with proper type
        const contact: {
          email: any;
          firstName: any;
          lastName: any;
          phone: string;
          assignedTo?: string;
          customField: Record<string, any>;
        } = {
          email: r.tenant_email,
          firstName: r.first_name,
          lastName: r.last_name,
          phone: primaryPhone,
          customField: {
            supabase_tenant_id: String(r.id),
            current_rental_address: r.rental_address,
            current_unit_number: r.unit_number,
            current_owner_name: r.unit_owner,
            current_owner_phones_json: JSON.stringify(r.owner_phone || [])
          }
        };
        
        // Add secondary phone as a custom field if available
        const cfSecondaryPhone = Deno.env.get("CF_SECONDARY_PHONE");
        if (secondaryPhone && cfSecondaryPhone) {
          // Format the secondary phone number with proper spacing
          const cleanedSecondary = secondaryPhone.replace(/\D/g, "");
          let formattedSecondary = "";
          
          if (cleanedSecondary.length === 10) {
            formattedSecondary = `+1 ${cleanedSecondary}`;
          } else if (cleanedSecondary.length === 11 && cleanedSecondary.startsWith("1")) {
            formattedSecondary = `+1 ${cleanedSecondary.substring(1)}`;
          } else if (cleanedSecondary.length > 0) {
            const truncated = cleanedSecondary.slice(0, 15);
            if (truncated.length >= 10) {
              formattedSecondary = `+${truncated.substring(0, 1)} ${truncated.substring(1)}`;
            } else {
              formattedSecondary = `+${truncated}`;
            }
          }
          
          if (formattedSecondary) {
            contact.customField[cfSecondaryPhone] = formattedSecondary;
          }
        }
        
        // Only add assignedTo if it exists
        const assignedTo = OWNERS[r.user_id];
        if (assignedTo) {
          contact.assignedTo = assignedTo;
        }
        
        // rent-totals
        const year = r.check_in_date?.substring(0, 4);
        const rent = Number(r.rent ?? 0);
        
        if (rent > 0 && year) {
          let existing = null;
          
          try {
            const ghSearchResponse = await fetch("https://rest.gohighlevel.com/v1/contacts/search", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${GHL.KEY}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                email: r.tenant_email || "" // Ensure email is never undefined
              })
            });
            
            if (!ghSearchResponse.ok) {
              console.error(`GHL contact search failed: ${ghSearchResponse.status} ${await ghSearchResponse.text()}`);
              continue; // Skip this tenant but continue processing others
            }
            
            const ghSearch = await ghSearchResponse.json();
            existing = ghSearch?.contacts?.[0];
          } catch (error) {
            const err = error as Error;
            console.error(`Error searching GHL contact: ${err.message}`);
            continue; // Skip this tenant but continue processing others
          }
          
          // Safe JSON parsing
          let totals: Record<string, number> = {};
          try {
            if (existing?.customField?.yearly_rent_totals_json) {
              totals = JSON.parse(existing.customField.yearly_rent_totals_json) as Record<string, number>;
            }
          } catch (error) {
            const err = error as Error;
            console.error(`Error parsing yearly_rent_totals_json: ${err.message}`);
            // Continue with empty totals object
          }
          
          // Ensure year is a string to avoid TypeScript errors
          const yearKey = String(year);
          totals[yearKey] = (totals[yearKey] ?? 0) + rent;
          contact.customField.yearly_rent_totals_json = JSON.stringify(totals);
          contact.customField.total_lifetime_rent = Object.values(totals).reduce((a: number, b) => a + Number(b), 0);
        }
        
        // upsert Contact with error handling
        try {
          const contactResponse = await fetch("https://rest.gohighlevel.com/v1/contacts/", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${GHL.KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(contact)
          });
          
          if (!contactResponse.ok) {
            console.error(`GHL contact upsert failed: ${contactResponse.status} ${await contactResponse.text()}`);
            continue; // Skip this tenant but continue processing others
          }
        } catch (error) {
          const err = error as Error;
          console.error(`Error upserting GHL contact: ${err.message}`);
          continue; // Skip this tenant but continue processing others
        }
        
        // choose Opportunity stage with fallback
        let stageId = GHL.STAGES.NEW_INQUIRY;
        
        if (year === "2026") stageId = GHL.STAGES.BOOKED_2026 || stageId;
        else if (year === "2025") stageId = GHL.STAGES.BOOKED_2025 || stageId;
        else if (r.status === "needs_search") stageId = GHL.STAGES.NEEDS_SEARCH || stageId;
        else if (r.status === "search_sent") stageId = GHL.STAGES.SEARCH_SENT || stageId;
        else if (Number(year) < 2025) stageId = GHL.STAGES.PAST_GUEST || stageId;
        
        // upsert Opportunity with error handling
        try {
          const opportunityResponse = await fetch("https://rest.gohighlevel.com/v1/opportunities/", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${GHL.KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              externalId: r.confirmation_number || `tenant-${r.id}`,
              name: r.confirmation_number || `Tenant ${r.id}`,
              pipelineId: GHL.PIPELINE,
              stageId,
              status: "open",
              monetaryValue: rent,
              contact: {
                email: r.tenant_email || "" // Ensure email is never undefined
              }
            })
          });
          
          if (!opportunityResponse.ok) {
            console.error(`GHL opportunity upsert failed: ${opportunityResponse.status} ${await opportunityResponse.text()}`);
            continue; // Skip this tenant but continue processing others
          }
        } catch (error) {
          const err = error as Error;
          console.error(`Error upserting GHL opportunity: ${err.message}`);
          continue; // Skip this tenant but continue processing others
        }
        
        // Mark tenant as successfully processed
        processedTenants.push(r);
        
      } catch (error) {
        const err = error as Error;
        console.error(`Error processing tenant ${r.id}: ${err.message}`);
        // Continue to next tenant
      }
    }
    
    // 4️⃣ write new checkpoint only if we processed at least one tenant
    if (processedTenants.length > 0) {
      try {
        // Find the latest timestamp from processed tenants
        const latestTimestamp = processedTenants.reduce((latest, tenant) => {
          const tenantTimestamp = new Date(
            tenant.last_scraped_at && tenant.created_at
              ? new Date(tenant.last_scraped_at) > new Date(tenant.created_at)
                ? tenant.last_scraped_at
                : tenant.created_at
              : tenant.last_scraped_at || tenant.created_at
          );
          return tenantTimestamp > latest ? tenantTimestamp : latest;
        }, new Date(sinceISO));
        
        const { error: updateError } = await supa.from("sync_state").upsert({
          id: "ghl_lease_sync",
          last_run_at: latestTimestamp.toISOString()
        });
        
        if (updateError) {
          console.error(`Failed to update checkpoint: ${updateError.message}`);
          return new Response(`Synced ${processedTenants.length} tenants but failed to update checkpoint`, {
            status: 500
          });
        }
        
        return new Response(`Synced ${processedTenants.length} tenants`, {
          status: 200
        });
      } catch (error) {
        const err = error as Error;
        console.error(`Error updating checkpoint: ${err.message}`);
        return new Response(`Synced ${processedTenants.length} tenants but failed to update checkpoint: ${err.message}`, {
          status: 500
        });
      }
    } else {
      return new Response("Processed 0 tenants successfully", {
        status: 200
      });
    }
  } catch (error) {
    const err = error as Error;
    console.error("Unhandled error:", err.message);
    return new Response(`Unhandled error: ${err.message}`, {
      status: 500
    });
  }
});
