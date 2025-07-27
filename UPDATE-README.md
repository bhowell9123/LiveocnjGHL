# Update Missing Tenants Tool

This tool identifies tenants that exist in Supabase but are missing in GoHighLevel, and updates their `last_scraped_at` timestamp to trigger a sync. This approach ensures that only the missing tenants are synced, without affecting existing contacts in GoHighLevel.

## How It Works

1. The script fetches tenants from Supabase and contacts from GoHighLevel
2. It identifies tenants that exist in Supabase but not in GoHighLevel
3. It updates the `last_scraped_at` timestamp for these missing tenants to the current time
4. When the sync function runs, it will process these tenants because their `last_scraped_at` timestamp is newer than the last checkpoint

This approach is ideal when you want to:
- Sync only the missing tenants without affecting existing contacts
- Avoid duplicate contacts in GoHighLevel
- Maintain the integrity of your existing GoHighLevel data

## Prerequisites

- Deno installed (https://deno.land/)
- Supabase service role key
- GoHighLevel API key
- Custom field ID for the tenant ID in GoHighLevel

## Environment Variables

The script requires the following environment variables, which can be set in a `.env` file:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GHL_API_KEY=your-ghl-api-key
CF_SUPABASE_TENANT_ID=your-tenant-id-custom-field-id
```

## Usage

Run the script with Deno:

```bash
chmod +x update-missing-tenants.ts  # Make the script executable (first time only)
./update-missing-tenants.ts
```

Or explicitly:

```bash
deno run --allow-net --allow-env --allow-read update-missing-tenants.ts
```

## Syncing Process

After running the script, you'll see a list of tenants that are missing in GoHighLevel. The script will update their `last_scraped_at` timestamp, and then you can trigger the sync function:

```bash
curl -X POST "https://bcuwccyyjgmshslnkpyv.functions.supabase.co/sync_leases-ts" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{}'
```

## Automating the Process

You can automate this process by adding the following to your cron job script:

```bash
# Update missing tenants
./update-missing-tenants.ts

# Trigger the sync function
curl -X POST "https://bcuwccyyjgmshslnkpyv.functions.supabase.co/sync_leases-ts" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{}'
```

## Troubleshooting

If you encounter any issues:

1. Ensure all required environment variables are set correctly
2. Check that your API keys have the necessary permissions
3. Verify that the custom field ID for the tenant ID is correct
4. Try running with a smaller limit if you're experiencing timeouts