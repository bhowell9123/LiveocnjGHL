#!/bin/bash
# extract-field-ids.sh - Extract GoHighLevel custom field IDs for sync_leases-ts

# Color codes for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}===== Extracting GoHighLevel Custom Field IDs =====${NC}"

# Check if GHL_API_KEY is set
if [ -z "$GHL_API_KEY" ]; then
  echo -e "${YELLOW}GHL_API_KEY environment variable not set.${NC}"
  read -p "Enter your GoHighLevel API Key: " api_key
  export GHL_API_KEY=$api_key
fi

# Location ID is hardcoded as in the Edge Function
LOCATION_ID="v5jAtUx8vmG1ucKOCjA8"

echo -e "\n${YELLOW}Fetching custom fields from GoHighLevel API...${NC}"

# First, get the raw response for debugging
raw_response=$(curl -s -X GET \
  "https://rest.gohighlevel.com/v1/custom-fields" \
  -H "Authorization: Bearer $GHL_API_KEY" \
  -H "LocationId: $LOCATION_ID")

echo -e "\n${YELLOW}Raw API Response:${NC}"
echo "$raw_response" | jq '.'

# The fixed jq command that properly navigates the JSON structure
result=$(echo "$raw_response" | jq -r '
    .customFields                       # dive into the array
    | map(select(.fieldKey as $k
        | $k == "contact.supabase_tenant_id"
        or $k == "contact.current_rental_address"
        or $k == "contact.current_unit_number"
        or $k == "contact.current_owner_name"
        or $k == "contact.current_owner_phones_json"))
    | .[] | "\(.fieldKey | sub("contact."; ""))=\(.id)"
')

if [ -z "$result" ]; then
  echo -e "${RED}Error: No custom fields found or API request failed.${NC}"
  echo "Check your API key and try again."
  exit 1
fi

echo -e "\n${GREEN}Custom Field IDs:${NC}"
echo "$result"

# Format for Supabase secrets
echo -e "\n${GREEN}Copy this command to set Supabase secrets:${NC}"
echo "supabase secrets set \\"

# Parse the results and format for Supabase secrets
while IFS= read -r line; do
  key=$(echo $line | cut -d'=' -f1)
  value=$(echo $line | cut -d'=' -f2)
  
  # Convert to uppercase with CF_ prefix
  formatted_key="CF_$(echo $key | tr '[:lower:]' '[:upper:]')"
  
  echo "  $formatted_key=$value \\"
done <<< "$result"

echo ""

echo -e "\n${YELLOW}Note:${NC} If you're using a specific project, add the project reference after logging in:"
echo "supabase login"
echo "supabase link --project-ref bcuwccyyjgmshslnkpyv"
echo "supabase secrets set CF_SUPABASE_TENANT_ID=value [...]"

echo -e "\n${YELLOW}Done!${NC}"