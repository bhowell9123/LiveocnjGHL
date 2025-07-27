# Supabase Edge Function Deployment Guide

This repository contains a Supabase Edge Function (`sync_leases-ts`) that synchronizes tenant data from a Supabase database to GoHighLevel contacts and opportunities.

## Deployment Options

### Option 1: Using the Deployment Script (Recommended)

We've created an automated deployment script that guides you through the entire process:

1. Open your terminal in VSCode (Ctrl+` or View > Terminal)
2. Run the deployment script:
   ```bash
   ./deploy.sh
   ```
3. Follow the interactive prompts to:
   - Verify your project structure
   - Log in to Supabase CLI (if needed)
   - Deploy the function
   - Set required environment variables/secrets
   - Test the deployed function

### Option 2: Manual Deployment

If you prefer to deploy manually, follow these steps:

1. **Open the Terminal in VSCode**
   - Press Ctrl+` (or View > Terminal) to open the integrated terminal.

2. **Verify You're in the Project Root**
   - Make sure you're in the directory that contains the supabase/ folder:
     ```bash
     pwd  # Should show your project path
     ls supabase/functions  # Should show sync_leases-ts
     ```

3. **Log in to Supabase CLI** (if not already logged in)
   ```bash
   supabase login
   # Paste your personal access token from app.supabase.com > Settings > Access Tokens
   ```

4. **Deploy the Function**
   ```bash
   supabase functions deploy sync_leases-ts \
     --project-ref bcuwccyyjgmshslnkpyv
   ```

5. **Set Required Secrets** (if you added/changed any)
   ```bash
   supabase secrets set \
     CF_SUPABASE_TENANT_ID=your_field_id \
     CF_CURRENT_RENTAL_ADDRESS=your_field_id \
     CF_CURRENT_UNIT_NUMBER=your_field_id \
     CF_CURRENT_OWNER_NAME=your_field_id \
     CF_CURRENT_OWNER_PHONES_JSON=your_field_id \
     --project-ref bcuwccyyjgmshslnkpyv
   ```

6. **Test the Deployed Function**
   ```bash
   curl -X POST \
     "https://bcuwccyyjgmshslnkpyv.functions.supabase.co/sync_leases-ts" \
     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

## Local Testing

### Setting Up Local Environment

We've provided a helper script to set up your local environment:

1. Run the setup script:
   ```bash
   ./setup-local-env.sh
   ```
2. The script will create a `.env.local` file from the template and open it in your editor
3. Fill in your actual values for all environment variables

### Running Local Tests

Once your environment is set up, you can test locally before deploying:

```bash
supabase functions serve sync_leases-ts --env-file ./supabase/.env.local
```

Then test with curl or Postman at http://localhost:54321/functions/v1/sync_leases-ts

### Using the Test Script

We've also provided a convenient test script that works for both local and production environments:

```bash
./test-function.sh
```

This interactive script will:
1. Ask whether you want to test locally or in production
2. Send a test request to the appropriate endpoint
3. Display the response from the function

## Monitoring and Logs

After deployment, you can monitor your function:
- Go to Supabase Studio → Edge Functions → sync_leases-ts → Logs

## Troubleshooting

If you're seeing 400 errors in the logs, ensure your custom fields are formatted correctly as an array of id/value pairs:

```javascript
contact.customField = [
  { id: Deno.env.get("CF_SUPABASE_TENANT_ID"), value: String(r.id) },
  // other fields...
];
```

## Required Environment Variables

The function requires the following environment variables:

### Critical Variables
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GHL_API_KEY`
- `GHL_PIPELINE_ID`

### Stage IDs
- `STAGE_NEW_INQUIRY_ID`
- `STAGE_NEEDS_SEARCH_ID`
- `STAGE_SEARCH_SENT_ID`
- `STAGE_BOOKED_2025_ID`
- `STAGE_BOOKED_2026_ID`
- `STAGE_PAST_GUEST_ID`

### Custom Field IDs
- `CF_SUPABASE_TENANT_ID`
- `CF_CURRENT_RENTAL_ADDRESS`
- `CF_CURRENT_UNIT_NUMBER`
- `CF_CURRENT_OWNER_NAME`
- `CF_CURRENT_OWNER_PHONES_JSON`

### User Mappings
- `SUPA_BRANDON_UUID`
- `GHL_BRANDON_USER_ID`
- `SUPA_CASSIDY_UUID`
- `GHL_CASSIDY_USER_ID`

## GoHighLevel API 1.0 Fixes

This function has been updated to fix issues with the GoHighLevel API 1.0 implementation. Key changes include:

### API Endpoint Fixes
- Changed contact search from `POST /contacts/search` to `GET /contacts/?email=...` to avoid 404 errors
- Updated opportunity creation to use `contactId` directly when an existing contact is found
- Ensured custom fields are properly formatted as an array of objects

### Implementation Details

The function now:
- Uses more reliable API endpoints for contact search
- Improves opportunity creation by directly linking to contacts when possible
- Validates and initializes custom fields to prevent 400 Bad Request errors

These fixes ensure reliable synchronization of tenant data to GoHighLevel contacts and opportunities.

### Testing the Fixes

See the [API Fix Test Plan](./API_FIX_TEST_PLAN.md) for detailed steps on testing the updated function.