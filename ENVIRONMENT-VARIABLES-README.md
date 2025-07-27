# Environment Variables for GoHighLevel Integration

This document explains the environment variables needed for the `sync_leases-ts` Edge Function to work properly with GoHighLevel.

## Issue Identified

The Edge Function was failing to create contacts and opportunities in GoHighLevel despite the API endpoints being fixed. The root cause was missing environment variables that are required for the function to work properly.

## Required Environment Variables

The Edge Function requires the following environment variables:

### 1. API Credentials
- `GHL_API_KEY` - GoHighLevel API key
- `LOCATION_ID` - GoHighLevel location ID

### 2. Custom Field IDs
- `CF_SUPABASE_TENANT_ID` - ID for the tenant ID custom field
- `CF_YEARLY_RENT_TOTALS_JSON` - ID for the yearly rent totals custom field
- `CF_TOTAL_LIFETIME_RENT` - ID for the total lifetime rent custom field
- `CF_CURRENT_RENTAL_ADDRESS` - ID for the rental address custom field
- `CF_CURRENT_UNIT_NUMBER` - ID for the unit number custom field
- `CF_CURRENT_OWNER_NAME` - ID for the owner name custom field
- `CF_CURRENT_OWNER_PHONES_JSON` - ID for the owner phones custom field

### 3. Pipeline and Stage IDs
- `GHL_PIPELINE_ID` - ID of the pipeline to create opportunities in
- `STAGE_NEW_INQUIRY_ID` - ID for the "New Inquiry" stage
- `STAGE_NEEDS_SEARCH_ID` - ID for the "Needs Search" stage
- `STAGE_SEARCH_SENT_ID` - ID for the "Search Sent" stage
- `STAGE_BOOKED_2025_ID` - ID for the "Booked 2025" stage
- `STAGE_BOOKED_2026_ID` - ID for the "Booked 2026" stage
- `STAGE_PAST_GUEST_ID` - ID for the "Past Guest" stage

### 4. User Mappings
- `SUPA_BRANDON_UUID` - Supabase UUID for Brandon
- `GHL_BRANDON_USER_ID` - GoHighLevel user ID for Brandon
- `SUPA_CASSIDY_UUID` - Supabase UUID for Cassidy
- `GHL_CASSIDY_USER_ID` - GoHighLevel user ID for Cassidy

## Tools Created

To help with setting up these environment variables, we've created the following tools:

### 1. Extended Field ID Extractor
- `grab-field-ids-extended.js` - A script that extracts all custom field IDs from GoHighLevel
- `EXTENDED-FIELD-IDS-README.md` - Documentation for the extended field ID extractor

### 2. Supabase Secrets Updater
- `update-supabase-secrets.sh` - A script that updates Supabase secrets with environment variables from the .env file

## How to Use

1. **Extract Custom Field IDs**:
   ```bash
   node grab-field-ids-extended.js
   ```
   This will output all the custom field IDs and a command to set them as Supabase secrets.

2. **Update the .env File**:
   Add all the required environment variables to the .env file. The custom field IDs will be automatically added by the script above, but you'll need to manually add the pipeline ID, stage IDs, and user mappings.

3. **Update Supabase Secrets**:
   ```bash
   ./update-supabase-secrets.sh
   ```
   This will update the Supabase secrets with the environment variables from the .env file.

4. **Deploy the Edge Function**:
   ```bash
   supabase functions deploy sync_leases-ts
   ```
   This will deploy the Edge Function with the updated environment variables.

## Troubleshooting

If contacts or opportunities are still not being created in GoHighLevel, check the following:

1. **API Credentials**: Make sure the API key and location ID are correct.
2. **Custom Field IDs**: Make sure all custom field IDs are set correctly.
3. **Pipeline and Stage IDs**: Make sure the pipeline ID and stage IDs are set correctly.
4. **User Mappings**: Make sure the user mappings are set correctly.
5. **Logs**: Check the Edge Function logs for any errors.

## Additional Notes

- The Edge Function uses the GoHighLevel API 1.0, not API 2.0.
- The contact search endpoint has been changed from `POST /contacts/search` to `GET /contacts/?email=...` to avoid 404 errors.
- The opportunity creation has been improved to use contactId directly when an existing contact is found.
- The custom field array is now explicitly validated and initialized to prevent 400 Bad Request errors.