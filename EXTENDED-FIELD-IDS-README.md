# Extended GoHighLevel Field ID Extractor

This script extends the original field ID extractor to include **all** custom fields needed for the `sync_leases-ts` Edge Function, including the rent-related fields that are used for opportunity creation.

## Additional Fields

In addition to the basic fields extracted by the original script, this extended version also extracts:

- `yearly_rent_totals_json` - Used to store yearly rent totals (CF_YEARLY_RENT_TOTALS_JSON)
- `total_lifetime_rent` - Used to store the total lifetime rent (CF_TOTAL_LIFETIME_RENT)

## Usage

1. Set your GoHighLevel API key as an environment variable:
   ```bash
   export GHL_API_KEY=sk_live_********************************
   ```

2. Run the script with Node.js:
   ```bash
   # For TypeScript directly (if ts-node is installed)
   ts-node grab-field-ids-extended.ts
   
   # Or compile and run
   tsc grab-field-ids-extended.ts
   node grab-field-ids-extended.js
   ```

3. The script will output the custom field IDs and a formatted command to set them as Supabase secrets.

## Additional Environment Variables Needed

The Edge Function also requires these environment variables that are not custom fields:

1. **GHL_PIPELINE_ID** - The ID of your pipeline
   - You can find this in the GoHighLevel dashboard under Pipelines

2. **Stage IDs** for different opportunity stages:
   - STAGE_NEW_INQUIRY_ID
   - STAGE_NEEDS_SEARCH_ID
   - STAGE_SEARCH_SENT_ID
   - STAGE_BOOKED_2025_ID
   - STAGE_BOOKED_2026_ID
   - STAGE_PAST_GUEST_ID
   
   You can find these in the GoHighLevel dashboard under Pipelines > [Your Pipeline] > Stages

3. **User Mappings** for contact assignment:
   - SUPA_BRANDON_UUID - Supabase UUID for Brandon
   - GHL_BRANDON_USER_ID - GoHighLevel user ID for Brandon
   - SUPA_CASSIDY_UUID - Supabase UUID for Cassidy
   - GHL_CASSIDY_USER_ID - GoHighLevel user ID for Cassidy

## Setting Supabase Secrets

After running the script, you'll get a command to set the custom field IDs as Supabase secrets. You'll need to manually add the pipeline ID, stage IDs, and user mappings:

```bash
supabase secrets set \
  CF_SUPABASE_TENANT_ID=value \
  CF_CURRENT_RENTAL_ADDRESS=value \
  CF_CURRENT_UNIT_NUMBER=value \
  CF_CURRENT_OWNER_NAME=value \
  CF_CURRENT_OWNER_PHONES_JSON=value \
  CF_YEARLY_RENT_TOTALS_JSON=value \
  CF_TOTAL_LIFETIME_RENT=value \
  GHL_PIPELINE_ID=value \
  STAGE_NEW_INQUIRY_ID=value \
  STAGE_NEEDS_SEARCH_ID=value \
  STAGE_SEARCH_SENT_ID=value \
  STAGE_BOOKED_2025_ID=value \
  STAGE_BOOKED_2026_ID=value \
  STAGE_PAST_GUEST_ID=value \
  SUPA_BRANDON_UUID=value \
  GHL_BRANDON_USER_ID=value \
  SUPA_CASSIDY_UUID=value \
  GHL_CASSIDY_USER_ID=value
```

## Creating Missing Custom Fields

If the script reports that some custom fields are missing, you'll need to create them in GoHighLevel:

1. Go to the GoHighLevel dashboard
2. Navigate to Settings > Custom Fields
3. Click "Add Custom Field"
4. Create the missing fields with the appropriate names and types:
   - `yearly_rent_totals_json` - Text field
   - `total_lifetime_rent` - Text field

After creating the custom fields, run the script again to get their IDs.

## Next Steps

After setting all the required secrets, redeploy the Edge Function:

```bash
# Make sure you're linked to your project first
supabase link --project-ref bcuwccyyjgmshslnkpyv

# Then deploy the function
supabase functions deploy sync_leases-ts
```

Check the logs to verify that contact and opportunity creation is working correctly:

```bash
# View logs
supabase functions logs sync_leases-ts