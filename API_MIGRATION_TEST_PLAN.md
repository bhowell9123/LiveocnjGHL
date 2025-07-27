# GoHighLevel API 2.0 Migration Test Plan

This document outlines the steps to test the migration from GoHighLevel API 1.0 to API 2.0 for the `sync_leases-ts` Edge Function.

## Prerequisites

Before testing, ensure you have:

1. Created a Private Integration in GoHighLevel Marketplace → Developer Portal
2. Obtained Client ID and Client Secret with the required scopes:
   - `contacts.write`
   - `opportunities.write`
3. Updated the environment variables in Supabase:
   ```bash
   supabase secrets set \
     GHL_CLIENT_ID=your_client_id \
     GHL_CLIENT_SECRET=your_client_secret \
     --project-ref bcuwccyyjgmshslnkpyv
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
   - Verify that the OAuth token was successfully obtained
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

1. **OAuth Token Errors**:
   - Verify that your Client ID and Client Secret are correct
   - Ensure your Private Integration has the required scopes

2. **404 Errors**:
   - Check that the endpoint paths are correct
   - Verify that the API 2.0 endpoints are accessible from your network

3. **400 Bad Request Errors**:
   - Review the request payload format
   - Check the logs for detailed error messages

4. **Rollback Plan**:
   If necessary, you can revert to API 1.0 by:
   - Restoring the original code from version control
   - Resetting the environment variables to use GHL_API_KEY instead of OAuth credentials
   - Redeploying the function

## Monitoring

After successful testing:

1. Set up the cron job to run regularly:
   ```bash
   ./sync-cron.sh
   ```

2. Monitor the logs for the first few sync cycles to ensure consistent success.

3. Check GoHighLevel periodically to verify that new tenants are being synced correctly.