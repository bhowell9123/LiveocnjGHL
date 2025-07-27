# GoHighLevel Contact Verification Tool

This tool helps you verify if specific contacts exist in GoHighLevel. It's useful for checking if the synchronization between your Supabase database and GoHighLevel is working correctly.

## Files

- `verify-ghl-contacts.ts` - The main TypeScript script that checks if contacts exist in GoHighLevel
- `check-ghl-contacts.sh` - A shell script wrapper to make it easier to run the verification script

## Prerequisites

- Deno runtime (for running the TypeScript script)
- GoHighLevel API key (the same one used in the sync_leases-ts function)

## Usage

### Using the Shell Script (Recommended)

The shell script provides a user-friendly way to run the verification tool:

```bash
./check-ghl-contacts.sh [email1] [email2] ...
```

Example:
```bash
./check-ghl-contacts.sh emily.johnson@example.com alex.thompson@example.com
```

If you don't provide any email addresses, the script will prompt you to enter one.

### Using the TypeScript Script Directly

You can also run the TypeScript script directly with Deno:

```bash
deno run --allow-net --allow-env verify-ghl-contacts.ts [email1] [email2] ...
```

Example:
```bash
deno run --allow-net --allow-env verify-ghl-contacts.ts emily.johnson@example.com
```

## How It Works

The verification tool:

1. Takes one or more email addresses as input
2. Queries the GoHighLevel API to check if contacts with those email addresses exist
3. Displays detailed information about each contact (if found)
4. Provides a summary of how many contacts were found and not found

## Troubleshooting

If you encounter any issues:

1. **API Key Issues**: Make sure your GoHighLevel API key is set correctly. You can set it in the `.env` file or as an environment variable:
   ```bash
   export GHL_API_KEY=your_api_key
   ```

2. **Permission Issues**: Ensure your API key has the necessary permissions to access contacts in GoHighLevel.

3. **Network Issues**: Check your internet connection and make sure you can access the GoHighLevel API.

## Verifying Synchronization

To verify that the synchronization between your Supabase database and GoHighLevel is working correctly:

1. Identify tenants in your Supabase database that should be synced to GoHighLevel
2. Run the verification tool with their email addresses
3. Check if they exist in GoHighLevel

If tenants are missing in GoHighLevel, you may need to:

1. Run the sync_leases-ts function again
2. Check the function logs for any errors
3. Verify that the tenant data in Supabase is correct