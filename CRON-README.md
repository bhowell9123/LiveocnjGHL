# Automated Tenant Synchronization

This document explains how to set up automated tenant synchronization between Supabase and GoHighLevel using the provided cron job script.

## Overview

The `sync-cron.sh` script automates the process of:

1. Checking for tenants that exist in Supabase but are missing in GoHighLevel
2. Updating the `last_scraped_at` timestamp for missing tenants using the `update-missing-tenants.ts` script
3. Triggering the `sync_leases-ts` Edge Function to insert those missing tenants into GoHighLevel
4. Verifying that the sync was successful by running a second comparison
5. Logging the results

This ensures that all tenants in your Supabase database are properly synced to GoHighLevel without manual intervention, while preserving existing contacts in GoHighLevel.

### How It Works

1. The script first runs `compare-tenants.ts` to identify tenants that exist in Supabase but not in GoHighLevel
2. If missing tenants are found, it runs the `update-missing-tenants.ts` script to update their `last_scraped_at` timestamp
3. Then it calls the `sync_leases-ts` Edge Function with a POST request
4. The Edge Function:
   - Queries tenants from Supabase that were created or updated since the last sync
   - Since the missing tenants now have a recent `last_scraped_at` timestamp, they will be included in the sync
   - For each tenant, creates or updates a contact in GoHighLevel with the tenant data
   - Updates the checkpoint time to avoid processing the same tenants again
5. After the sync, the script runs another comparison to verify that the missing tenants were successfully added to GoHighLevel

## Prerequisites

- Bash shell environment
- Cron job capability (Linux/macOS server or hosting environment)
- Environment variables set up in `.env` file
- `compare-tenants.ts` script in the same directory
- Proper permissions to execute the scripts

## Setting Up the Cron Job

### 1. Make the script executable

```bash
chmod +x sync-cron.sh
```

### 2. Test the script manually

```bash
./sync-cron.sh
```

### 3. Add to crontab

Edit your crontab:

```bash
crontab -e
```

Add a line to run the script at your desired frequency. For example, to run every 6 hours:

```
0 */6 * * * /full/path/to/sync-cron.sh >> /path/to/sync-cron.log 2>&1
```

Replace `/full/path/to/` with the actual path to your script.

### 4. Verify the cron job

Check that your cron job is scheduled:

```bash
crontab -l
```

## Logging

The script outputs detailed logs about:
- When the job started and completed
- How many tenants were missing in GoHighLevel
- Whether the sync function was triggered
- The response from the sync function

If you set up the cron job as suggested above, these logs will be appended to the specified log file.

## Troubleshooting

If the cron job is not running as expected:

1. Check the log file for error messages
2. Ensure the script has execute permissions
3. Verify that all required environment variables are set in the `.env` file
4. Make sure the paths in the crontab entry are correct
5. Check that the user running the cron job has the necessary permissions

## Customizing the Schedule

The recommended schedule is every 6 hours, but you can adjust this based on your needs:

- Every hour: `0 * * * *`
- Every 12 hours: `0 */12 * * *`
- Once a day at midnight: `0 0 * * *`
- Once a week on Sunday at midnight: `0 0 * * 0`

## Security Considerations

- The script requires your Supabase service role key, which has high privileges
- Ensure the `.env` file has restricted permissions (e.g., `chmod 600 .env`)
- Consider using a dedicated service account with limited permissions for production environments