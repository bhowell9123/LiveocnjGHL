#!/bin/bash
# sync-cron.sh - Cron job script to automate tenant synchronization
# 
# This script is designed to be run as a cron job to ensure that all tenants
# in Supabase are properly synced to GoHighLevel. It:
# 1. Runs the compare-tenants.ts script to check for missing tenants
# 2. If there are missing tenants, triggers the sync_leases-ts function
# 3. Logs the results
#
# Recommended cron schedule: 0 */6 * * * (every 6 hours)
# Example crontab entry:
# 0 */6 * * * /path/to/sync-cron.sh >> /path/to/sync-cron.log 2>&1

# Set the working directory to the script's directory
cd "$(dirname "$0")"

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
else
  echo "Error: .env file not found"
  exit 1
fi

# Check if required environment variables are set
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "Error: SUPABASE_SERVICE_ROLE_KEY is not set in .env file"
  exit 1
fi

# Log start time
echo "===== Tenant Sync Job Started at $(date) ====="

# Create a temporary file to store the comparison results
TEMP_FILE=$(mktemp)

# Run the comparison script and capture the output
echo "Running tenant comparison..."
./compare-tenants.ts > "$TEMP_FILE"

# Check if there are missing tenants
MISSING_COUNT=$(grep "Tenants missing in GHL:" "$TEMP_FILE" | awk '{print $4}')
echo "Found $MISSING_COUNT tenants missing in GoHighLevel"

# If there are missing tenants, update their timestamps and trigger the sync function
if [ "$MISSING_COUNT" -gt 0 ]; then
  echo "Found $MISSING_COUNT missing tenants."
  
  # Update the last_scraped_at timestamp for missing tenants
  echo "Updating last_scraped_at timestamp for missing tenants..."
  ./update-missing-tenants.ts
  
  # The sync_leases-ts function will:
  # 1. Query tenants from Supabase that were created/updated since the last sync
  # 2. For each tenant, create/update a contact in GoHighLevel with the tenant data
  # 3. Update the checkpoint time to avoid processing the same tenants again
  echo "Triggering sync_leases-ts function to insert them into GoHighLevel..."
  SYNC_RESULT=$(curl -s -X POST "https://bcuwccyyjgmshslnkpyv.functions.supabase.co/sync_leases-ts" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -d '{}')
  
  echo "Sync function response: $SYNC_RESULT"
  
  # Run the comparison again to verify that tenants were synced
  echo "Verifying sync results..."
  ./compare-tenants.ts --limit=10 > "$TEMP_FILE.verify"
  REMAINING_COUNT=$(grep "Tenants missing in GHL:" "$TEMP_FILE.verify" | awk '{print $4}')
  
  if [ "$REMAINING_COUNT" -lt "$MISSING_COUNT" ]; then
    echo "Sync successful! Reduced missing tenants from $MISSING_COUNT to $REMAINING_COUNT"
  else
    echo "Warning: Sync may have failed. Still have $REMAINING_COUNT missing tenants"
  fi
  
  rm "$TEMP_FILE.verify"
else
  echo "No missing tenants found, skipping sync"
fi

# Clean up the temporary file
rm "$TEMP_FILE"

# Log end time
echo "===== Tenant Sync Job Completed at $(date) ====="
echo ""

exit 0