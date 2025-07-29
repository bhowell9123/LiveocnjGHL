#!/bin/bash
# This script runs the tenant sync validation process

set -e  # Exit on error

echo "=== Starting Tenant Sync Validation ==="
echo

# Check if environment variables are set
if [ -z "$LOCATION_ID" ] || [ -z "$GHL_API_V2_KEY" ] || [ -z "$CF_TOTAL_LIFETIME_RENT" ]; then
  echo "Error: Required environment variables are not set."
  echo "Please set the following environment variables:"
  echo "  - LOCATION_ID"
  echo "  - GHL_API_V2_KEY"
  echo "  - CF_TOTAL_LIFETIME_RENT"
  echo
  echo "You can set them in your .env file or export them directly."
  exit 1
fi

# Step 1: Fetch contacts from GHL
echo "Step 1: Fetching contacts from GoHighLevel..."
deno run --allow-net --allow-env --allow-read --allow-write scripts/fetch100.ts
echo

# Step 2: Compare data
echo "Step 2: Comparing Supabase and GoHighLevel data..."
deno run --allow-net --allow-env --allow-read --allow-write scripts/compare100.ts
echo

echo "=== Validation Complete ==="
echo "Review the sync_validation_report.json file for results."
echo "See scripts/README.md for interpretation guidance."