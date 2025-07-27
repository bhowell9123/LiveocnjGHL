# Tenant Comparison Tool

This tool compares tenants in Supabase with contacts in GoHighLevel to identify any discrepancies. It helps ensure that all tenants in your Supabase database are properly synced to GoHighLevel as contacts.

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
chmod +x compare-tenants.ts  # Make the script executable (first time only)
./compare-tenants.ts
```

Or explicitly:

```bash
deno run --allow-net --allow-env --allow-read compare-tenants.ts
```

### Options

- `--limit=<number>`: Limit the number of tenants to fetch from Supabase (default: 100)

Example:

```bash
./compare-tenants.ts --limit=500
```

## Output

The script will output:

1. The total number of tenants in Supabase
2. The total number of contacts in GoHighLevel with tenant IDs
3. The number of tenants missing in GoHighLevel
4. A list of tenants that exist in Supabase but not in GoHighLevel
5. Instructions for syncing the missing tenants

## How It Works

1. The script fetches tenants from Supabase
2. It fetches all contacts from GoHighLevel (with pagination)
3. It extracts the tenant ID from each GoHighLevel contact's custom fields
4. It compares the two sets of data to find tenants that exist in Supabase but not in GoHighLevel
5. It displays the results and provides instructions for syncing the missing tenants

## Troubleshooting

If you encounter any issues:

1. Ensure all required environment variables are set correctly
2. Check that your API keys have the necessary permissions
3. Verify that the custom field ID for the tenant ID is correct
4. Try running with a smaller limit if you're experiencing timeouts

## Syncing Missing Tenants

To sync missing tenants to GoHighLevel, run:

```bash
curl -X POST "https://bcuwccyyjgmshslnkpyv.functions.supabase.co/sync_leases-ts" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{}'
```

This will trigger the sync_leases-ts Edge Function, which will process any tenants that have been created or updated since the last sync.