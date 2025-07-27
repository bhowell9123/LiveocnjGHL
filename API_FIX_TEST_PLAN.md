# GoHighLevel API 1.0 Fix Test Plan

This document outlines the steps to test the fixes for the GoHighLevel API 1.0 implementation in the `sync_leases-ts` Edge Function.

## Changes Made

We've made the following changes to fix the synchronization issues:

1. **Fixed Contact Search**:
   - Changed from using `POST /contacts/search` to `GET /contacts/?email=...`
   - This avoids the 404 errors on the search endpoint

2. **Fixed Opportunity Creation**:
   - Added support for using `contactId` directly when an existing contact is found
   - This improves the reliability of linking opportunities to contacts

3. **Improved Custom Field Handling**:
   - Added explicit validation and initialization of the `customField` array
   - This helps prevent 400 Bad Request errors when upserting contacts

## Prerequisites

Before testing, ensure you have:

1. A valid GoHighLevel API key with appropriate permissions
2. The API key is set in your environment variables:
   ```bash
   supabase secrets set GHL_API_KEY=your_api_key --project-ref bcuwccyyjgmshslnkpyv
   ```

## Test Plan

### Step 1: Deploy the Updated Function

```bash
# Make sure you're linked to your project
supabase link --project-ref bcuwccyyjgmshslnkpyv

# Deploy the updated function
supabase functions deploy sync_leases-ts
```

### Step 2: Test with a Single Tenant

1. Insert a test tenant into the database:
   ```bash
   psql -h db.bcuwccyyjgmshslnkpyv.supabase.co -p 5432 -d postgres -U postgres -f insert_test_tenant.sql
   ```

2. Run the test function script:
   ```bash
   ./test-function.sh
   ```
   
3. Select option 2 to test in production.

### Step 3: Verify Results

1. Check the function logs in Supabase Studio:
   - Go to Supabase Studio → Edge Functions → sync_leases-ts → Logs
   - Verify that the contact search is successful (look for "Get contacts response status: 200")
   - Confirm that the contact and opportunity were created with 200 status codes

2. Check GoHighLevel:
   - Log in to your GoHighLevel account
   - Verify that the test tenant appears as a contact
   - Confirm that an opportunity was created for the tenant
   - Check that custom fields are correctly populated

### Step 4: Test with Multiple Tenants

1. Run the compare-tenants.ts script to identify missing tenants:
   ```bash
   deno run --allow-net --allow-env compare-tenants.ts
   ```

2. Run the update-missing-tenants.ts script to mark tenants for syncing:
   ```bash
   deno run --allow-net --allow-env update-missing-tenants.ts
   ```

3. Run the Edge Function again to sync all missing tenants:
   ```bash
   ./test-function.sh
   ```

4. Verify that all tenants were successfully synced by checking the logs and GoHighLevel.

## Troubleshooting

If you encounter issues:

1. **404 Errors**:
   - Verify that the API endpoints are correct
   - Check that your API key has access to the required endpoints

2. **400 Bad Request Errors**:
   - Review the request payload format in the logs
   - Ensure that custom fields are properly formatted as an array of objects

3. **Authentication Issues**:
   - Verify that your API key is valid and has not expired
   - Check that the location ID is correct

## Monitoring

After successful testing:

1. Set up the cron job to run regularly:
   ```bash
   ./sync-cron.sh
   ```

2. Monitor the logs for the first few sync cycles to ensure consistent success.

3. Check GoHighLevel periodically to verify that new tenants are being synced correctly.