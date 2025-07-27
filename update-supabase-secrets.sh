#!/bin/bash
# update-supabase-secrets.sh - Update Supabase secrets with environment variables from .env file

# Color codes for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}===== Updating Supabase Secrets from .env file =====${NC}"

# Check if .env file exists
if [ ! -f ".env" ]; then
  echo -e "${RED}Error: .env file not found!${NC}"
  echo "Please run this script from the project root directory."
  exit 1
fi

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo -e "${RED}Error: supabase CLI not found!${NC}"
  echo "Please install the Supabase CLI first:"
  echo "npm install -g supabase"
  exit 1
fi

# Extract custom field IDs from .env file
CF_SUPABASE_TENANT_ID=$(grep CF_SUPABASE_TENANT_ID .env | cut -d'=' -f2)
CF_YEARLY_RENT_TOTALS_JSON=$(grep CF_YEARLY_RENT_TOTALS_JSON .env | cut -d'=' -f2)
CF_TOTAL_LIFETIME_RENT=$(grep CF_TOTAL_LIFETIME_RENT .env | cut -d'=' -f2)
CF_CURRENT_RENTAL_ADDRESS=$(grep CF_CURRENT_RENTAL_ADDRESS .env | cut -d'=' -f2)
CF_CURRENT_UNIT_NUMBER=$(grep CF_CURRENT_UNIT_NUMBER .env | cut -d'=' -f2)
CF_CURRENT_OWNER_NAME=$(grep CF_CURRENT_OWNER_NAME .env | cut -d'=' -f2)
CF_CURRENT_OWNER_PHONES_JSON=$(grep CF_CURRENT_OWNER_PHONES_JSON .env | cut -d'=' -f2)

# Check if all custom field IDs are set
if [ -z "$CF_SUPABASE_TENANT_ID" ] || [ -z "$CF_YEARLY_RENT_TOTALS_JSON" ] || [ -z "$CF_TOTAL_LIFETIME_RENT" ] || [ -z "$CF_CURRENT_RENTAL_ADDRESS" ] || [ -z "$CF_CURRENT_UNIT_NUMBER" ] || [ -z "$CF_CURRENT_OWNER_NAME" ] || [ -z "$CF_CURRENT_OWNER_PHONES_JSON" ]; then
  echo -e "${RED}Error: Some custom field IDs are missing in .env file!${NC}"
  echo "Please run grab-field-ids-extended.js to get all custom field IDs."
  exit 1
fi

# Link to the project
echo -e "\n${YELLOW}Linking to Supabase project...${NC}"
echo "supabase link --project-ref bcuwccyyjgmshslnkpyv"
read -p "Do you want to link to the project now? (y/n): " link_choice
if [[ $link_choice == "y" || $link_choice == "Y" ]]; then
  supabase link --project-ref bcuwccyyjgmshslnkpyv
  if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to link to the project!${NC}"
    exit 1
  fi
fi

# Set the secrets
echo -e "\n${YELLOW}Setting Supabase secrets...${NC}"
echo "supabase secrets set \\"
echo "  CF_SUPABASE_TENANT_ID=$CF_SUPABASE_TENANT_ID \\"
echo "  CF_YEARLY_RENT_TOTALS_JSON=$CF_YEARLY_RENT_TOTALS_JSON \\"
echo "  CF_TOTAL_LIFETIME_RENT=$CF_TOTAL_LIFETIME_RENT \\"
echo "  CF_CURRENT_RENTAL_ADDRESS=$CF_CURRENT_RENTAL_ADDRESS \\"
echo "  CF_CURRENT_UNIT_NUMBER=$CF_CURRENT_UNIT_NUMBER \\"
echo "  CF_CURRENT_OWNER_NAME=$CF_CURRENT_OWNER_NAME \\"
echo "  CF_CURRENT_OWNER_PHONES_JSON=$CF_CURRENT_OWNER_PHONES_JSON"

read -p "Do you want to set these secrets now? (y/n): " set_choice
if [[ $set_choice == "y" || $set_choice == "Y" ]]; then
  supabase secrets set \
    CF_SUPABASE_TENANT_ID=$CF_SUPABASE_TENANT_ID \
    CF_YEARLY_RENT_TOTALS_JSON=$CF_YEARLY_RENT_TOTALS_JSON \
    CF_TOTAL_LIFETIME_RENT=$CF_TOTAL_LIFETIME_RENT \
    CF_CURRENT_RENTAL_ADDRESS=$CF_CURRENT_RENTAL_ADDRESS \
    CF_CURRENT_UNIT_NUMBER=$CF_CURRENT_UNIT_NUMBER \
    CF_CURRENT_OWNER_NAME=$CF_CURRENT_OWNER_NAME \
    CF_CURRENT_OWNER_PHONES_JSON=$CF_CURRENT_OWNER_PHONES_JSON
  
  if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to set secrets!${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}✓ Secrets set successfully${NC}"
else
  echo "Skipping setting secrets."
fi

echo -e "\n${YELLOW}Additional Environment Variables Needed:${NC}"
echo "The Edge Function also requires these environment variables:"
echo "1. GHL_PIPELINE_ID - The ID of your pipeline"
echo "2. Stage IDs for different opportunity stages:"
echo "   - STAGE_NEW_INQUIRY_ID"
echo "   - STAGE_NEEDS_SEARCH_ID"
echo "   - STAGE_SEARCH_SENT_ID"
echo "   - STAGE_BOOKED_2025_ID"
echo "   - STAGE_BOOKED_2026_ID"
echo "   - STAGE_PAST_GUEST_ID"
echo "3. User Mappings for contact assignment:"
echo "   - SUPA_BRANDON_UUID"
echo "   - GHL_BRANDON_USER_ID"
echo "   - SUPA_CASSIDY_UUID"
echo "   - GHL_CASSIDY_USER_ID"

echo -e "\n${YELLOW}Next Steps:${NC}"
echo "1. Get the pipeline ID and stage IDs from GoHighLevel dashboard"
echo "2. Add them to the .env file"
echo "3. Run this script again to set those secrets"
echo "4. Deploy the Edge Function:"
echo "   supabase functions deploy sync_leases-ts"

echo -e "\n${GREEN}Done!${NC}"