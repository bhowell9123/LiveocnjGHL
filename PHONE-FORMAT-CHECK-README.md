# Phone Number Formatting Check and Fix

This documentation explains how to identify and fix phone number formatting issues in GoHighLevel contacts.

## Background

The `sync_leases-ts` function had an issue where multiple phone numbers were being concatenated into a single string when syncing tenant data to GoHighLevel (GHL). This resulted in invalid phone numbers like `+1908581895590880`.

The issue has been fixed in the latest version of the function, but existing contacts in GHL may still have formatting issues from before the fix was deployed.

## Scripts

Two scripts are provided to help identify and fix these formatting issues:

1. `check-phone-formatting.ts`: Identifies contacts with phone number formatting issues
2. `fix-phone-formatting.ts`: Fixes the identified issues by triggering a re-sync of the affected tenants

## Prerequisites

Before running these scripts, make sure you have:

1. Deno installed on your system
2. A `.env` file with the following environment variables:
   - `SUPABASE_URL`: The URL of your Supabase project
   - `SUPABASE_SERVICE_ROLE_KEY`: The service role key for your Supabase project
   - `GHL_API_KEY`: Your GoHighLevel API key
   - `LOCATION_ID`: Your GoHighLevel location ID

## Checking for Formatting Issues

To check for phone number formatting issues, run:

```bash
deno run --allow-net --allow-env --allow-read --allow-write check-phone-formatting.ts
```

This script will:

1. Fetch all tenants from Supabase
2. Fetch all contacts from GoHighLevel
3. Match them based on tenant ID
4. Check for phone number formatting issues
5. Generate a report of any issues found in `formatting-issues.json`

You can specify a different output file using the `--output` flag:

```bash
deno run --allow-net --allow-env --allow-read --allow-write check-phone-formatting.ts --output=my-report.json
```

## What the Check Script Looks For

The script identifies contacts that may have concatenated or improperly formatted phone numbers by:

1. Matching Supabase tenants with GHL contacts using the tenant ID custom field
2. Comparing the phone numbers between the two systems
3. Flagging contacts where the GHL phone number is significantly longer than the tenant phone number (indicating possible concatenation)

## Fixing Formatting Issues

To fix the identified formatting issues, run:

```bash
deno run --allow-net --allow-env --allow-read fix-phone-formatting.ts
```

This script will:

1. Read the formatting issues from `formatting-issues.json`
2. Update the `last_scraped_at` field for the affected tenants in Supabase
3. This will trigger a re-sync of the tenants with the fixed code, which will update the phone numbers in GHL

You can specify a different input file using the `--input` flag:

```bash
deno run --allow-net --allow-env --allow-read fix-phone-formatting.ts --input=my-report.json
```

To see what changes would be made without actually applying them, use the `--dry-run` flag:

```bash
deno run --allow-net --allow-env --allow-read fix-phone-formatting.ts --dry-run
```

## How the Fix Works

The fix works by updating the `last_scraped_at` field for the affected tenants in Supabase. This will trigger a re-sync of the tenants the next time the `sync_leases-ts` function runs.

The `sync_leases-ts` function has been fixed to properly handle phone numbers, so when it runs again, it will update the contacts in GHL with the correct phone numbers.

## Manually Triggering the Sync

If you want to immediately trigger the sync after running the fix script, you can use the following command:

```bash
curl -X POST "https://bcuwccyyjgmshslnkpyv.functions.supabase.co/sync_leases-ts" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -d '{}'
```

Replace `$SUPABASE_SERVICE_ROLE_KEY` with your actual Supabase service role key.

## Verifying the Fix

After running the fix script and triggering the sync, you can run the check script again to verify that the formatting issues have been fixed:

```bash
deno run --allow-net --allow-env --allow-read --allow-write check-phone-formatting.ts
```

If the fix was successful, the script should report that no formatting issues were found.

## Alternative Fix Method

If you prefer to update the contacts in GHL directly instead of triggering a re-sync, you can do so through the GHL UI or API. However, using the provided fix script is recommended as it ensures the contacts are updated using the same logic as the sync function.