# GoHighLevel Custom Field ID Extractor

This directory contains two scripts to extract custom field IDs from GoHighLevel and format them for use with the `sync_leases-ts` Edge Function.

## Background

The Edge Function needs specific GoHighLevel custom field IDs to properly map tenant data. These scripts extract the IDs for the following custom fields:

- `supabase_tenant_id`
- `current_rental_address`
- `current_unit_number`
- `current_owner_name`
- `current_owner_phones_json`

## Option 1: Shell Script (Bash/Zsh)

The shell script uses `curl` and `jq` to extract the custom field IDs.

### Prerequisites

- Bash or Zsh shell
- `curl` (usually pre-installed)
- `jq` (install with `brew install jq` on macOS or `sudo apt-get install jq` on Ubuntu)

### Usage

1. Make the script executable:
   ```bash
   chmod +x extract-field-ids.sh
   ```

2. Set your GoHighLevel API key as an environment variable:
   ```bash
   export GHL_API_KEY=sk_live_********************************
   ```

3. Run the script:
   ```bash
   # Make sure to include ./ to run from the current directory
   ./extract-field-ids.sh
   ```

4. The script will output the custom field IDs and a formatted command to set them as Supabase secrets.

## Option 2: TypeScript Script

The TypeScript script uses the built-in `fetch` API to extract the custom field IDs.

### Prerequisites

- Node.js 18+ (for built-in fetch API)
- For older Node.js versions, install `node-fetch`:
  ```bash
  npm install node-fetch
  ```
  Then modify the script to import fetch.

### Usage

1. Set your GoHighLevel API key as an environment variable:
   ```bash
   export GHL_API_KEY=sk_live_********************************
   ```

2. Run the script with Node.js:
   ```bash
   # For TypeScript directly (if ts-node is installed)
   ts-node grab-field-ids.ts
   
   # Or compile and run
   tsc grab-field-ids.ts
   node grab-field-ids.js
   ```

3. The script will output the custom field IDs and a formatted command to set them as Supabase secrets.

## Setting Supabase Secrets

After running either script, you'll get a command like:

```bash
supabase secrets set \
  CF_SUPABASE_TENANT_ID=AW3n8LdlQWzJv4nO2F1o \
  CF_CURRENT_RENTAL_ADDRESS=B0pqLMN789 \
  CF_CURRENT_UNIT_NUMBER=C1xyZ567 \
  CF_CURRENT_OWNER_NAME=D2abC890 \
  CF_CURRENT_OWNER_PHONES_JSON=E3fgH123
```

To use this command with a specific Supabase project, you need to:

1. Log in to Supabase CLI (if not already logged in):
   ```bash
   supabase login
   ```

2. Link to your specific project:
   ```bash
   supabase link --project-ref bcuwccyyjgmshslnkpyv
   ```

3. Then set the secrets:
   ```bash
   supabase secrets set CF_SUPABASE_TENANT_ID=value [...]
   ```

## Next Steps

After setting the secrets, redeploy the Edge Function:

```bash
# Make sure you're linked to your project first
supabase link --project-ref bcuwccyyjgmshslnkpyv

# Then deploy the function
supabase functions deploy sync_leases-ts
```

Check the logs to verify that contact upserts now return 200 status codes instead of 400 errors:

```bash
# View logs
supabase functions logs sync_leases-ts
```