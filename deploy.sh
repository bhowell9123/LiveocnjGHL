#!/bin/bash
# deploy.sh - Deployment script for sync_leases-ts Supabase Edge Function

# Color codes for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}===== Supabase Edge Function Deployment - sync_leases-ts =====${NC}"

# Step 1: Verify we're in the project root
echo -e "\n${YELLOW}Step 1: Verifying project location...${NC}"
if [ ! -d "supabase/functions/sync_leases-ts" ]; then
  echo -e "${RED}Error: supabase/functions/sync_leases-ts directory not found!${NC}"
  echo "Please run this script from the project root directory."
  exit 1
fi

echo -e "${GREEN}✓ Project structure verified${NC}"
echo "Current directory: $(pwd)"
echo "Function directory: $(ls -la supabase/functions/sync_leases-ts)"

# Step 2: Check if user is logged in to Supabase CLI
echo -e "\n${YELLOW}Step 2: Checking Supabase CLI login status...${NC}"
if ! supabase projects list &>/dev/null; then
  echo -e "${YELLOW}You need to log in to Supabase CLI${NC}"
  echo "Get your access token from: app.supabase.com > Settings > Access Tokens"
  echo -e "Run: ${GREEN}supabase login${NC}"
  
  read -p "Would you like to log in now? (y/n): " login_choice
  if [[ $login_choice == "y" || $login_choice == "Y" ]]; then
    supabase login
  else
    echo -e "${RED}Deployment aborted. Please log in and try again.${NC}"
    exit 1
  fi
fi

echo -e "${GREEN}✓ Supabase CLI login verified${NC}"

# Step 3: Deploy the function
echo -e "\n${YELLOW}Step 3: Deploying function to Supabase...${NC}"
echo "This will deploy everything in supabase/functions/sync_leases-ts/ to Supabase"

read -p "Continue with deployment? (y/n): " deploy_choice
if [[ $deploy_choice != "y" && $deploy_choice != "Y" ]]; then
  echo -e "${RED}Deployment aborted.${NC}"
  exit 1
fi

echo "Deploying function..."
supabase functions deploy sync_leases-ts --project-ref bcuwccyyjgmshslnkpyv

if [ $? -ne 0 ]; then
  echo -e "${RED}Deployment failed!${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Function deployed successfully${NC}"

# Step 4: Set required secrets
echo -e "\n${YELLOW}Step 4: Setting required secrets...${NC}"
echo "The function requires several environment variables to be set."

# Check if .env file exists
if [ -f ".env" ]; then
  echo "Found .env file. Extracting custom field IDs..."
  
  # Extract values from .env file
  cf_tenant_id=$(grep "CF_SUPABASE_TENANT_ID" .env | cut -d'=' -f2)
  cf_rental_address=$(grep "CF_CURRENT_RENTAL_ADDRESS" .env | cut -d'=' -f2)
  cf_unit_number=$(grep "CF_CURRENT_UNIT_NUMBER" .env | cut -d'=' -f2)
  cf_owner_name=$(grep "CF_CURRENT_OWNER_NAME" .env | cut -d'=' -f2)
  cf_owner_phones=$(grep "CF_CURRENT_OWNER_PHONES_JSON" .env | cut -d'=' -f2)
  cf_yearly_rent=$(grep "CF_YEARLY_RENT_TOTALS_JSON" .env | cut -d'=' -f2)
  cf_lifetime_rent=$(grep "CF_TOTAL_LIFETIME_RENT" .env | cut -d'=' -f2)
  
  # Check if all values were found
  if [ -z "$cf_tenant_id" ] || [ -z "$cf_rental_address" ] || [ -z "$cf_unit_number" ] || [ -z "$cf_owner_name" ] || [ -z "$cf_owner_phones" ] || [ -z "$cf_yearly_rent" ] || [ -z "$cf_lifetime_rent" ]; then
    echo -e "${YELLOW}Some custom field IDs were not found in .env file.${NC}"
    read -p "Would you like to set/update these secrets manually? (y/n): " secrets_choice
    
    if [[ $secrets_choice == "y" || $secrets_choice == "Y" ]]; then
      # Collect the values
      [ -z "$cf_tenant_id" ] && read -p "CF_SUPABASE_TENANT_ID (GHL custom field ID): " cf_tenant_id
      [ -z "$cf_rental_address" ] && read -p "CF_CURRENT_RENTAL_ADDRESS (GHL custom field ID): " cf_rental_address
      [ -z "$cf_unit_number" ] && read -p "CF_CURRENT_UNIT_NUMBER (GHL custom field ID): " cf_unit_number
      [ -z "$cf_owner_name" ] && read -p "CF_CURRENT_OWNER_NAME (GHL custom field ID): " cf_owner_name
      [ -z "$cf_owner_phones" ] && read -p "CF_CURRENT_OWNER_PHONES_JSON (GHL custom field ID): " cf_owner_phones
      [ -z "$cf_yearly_rent" ] && read -p "CF_YEARLY_RENT_TOTALS_JSON (GHL custom field ID): " cf_yearly_rent
      [ -z "$cf_lifetime_rent" ] && read -p "CF_TOTAL_LIFETIME_RENT (GHL custom field ID): " cf_lifetime_rent
    else
      echo "Skipping secrets setup."
      echo "You can set them later using:"
      echo "supabase secrets set [KEY=VALUE...] --project-ref bcuwccyyjgmshslnkpyv"
    fi
  else
    echo -e "${GREEN}✓ All custom field IDs found in .env file${NC}"
  fi
else
  echo -e "${YELLOW}.env file not found. Please enter the custom field IDs manually:${NC}"
  
  # Collect the values
  read -p "CF_SUPABASE_TENANT_ID (GHL custom field ID): " cf_tenant_id
  read -p "CF_CURRENT_RENTAL_ADDRESS (GHL custom field ID): " cf_rental_address
  read -p "CF_CURRENT_UNIT_NUMBER (GHL custom field ID): " cf_unit_number
  read -p "CF_CURRENT_OWNER_NAME (GHL custom field ID): " cf_owner_name
  read -p "CF_CURRENT_OWNER_PHONES_JSON (GHL custom field ID): " cf_owner_phones
  read -p "CF_YEARLY_RENT_TOTALS_JSON (GHL custom field ID): " cf_yearly_rent
  read -p "CF_TOTAL_LIFETIME_RENT (GHL custom field ID): " cf_lifetime_rent
fi

# Set the secrets if values are available
if [ -n "$cf_tenant_id" ] || [ -n "$cf_rental_address" ] || [ -n "$cf_unit_number" ] || [ -n "$cf_owner_name" ] || [ -n "$cf_owner_phones" ] || [ -n "$cf_yearly_rent" ] || [ -n "$cf_lifetime_rent" ]; then
  echo "Setting secrets..."
  
  # Build the command dynamically based on which values are available
  cmd="supabase secrets set"
  [ -n "$cf_tenant_id" ] && cmd="$cmd CF_SUPABASE_TENANT_ID=$cf_tenant_id"
  [ -n "$cf_rental_address" ] && cmd="$cmd CF_CURRENT_RENTAL_ADDRESS=$cf_rental_address"
  [ -n "$cf_unit_number" ] && cmd="$cmd CF_CURRENT_UNIT_NUMBER=$cf_unit_number"
  [ -n "$cf_owner_name" ] && cmd="$cmd CF_CURRENT_OWNER_NAME=$cf_owner_name"
  [ -n "$cf_owner_phones" ] && cmd="$cmd CF_CURRENT_OWNER_PHONES_JSON=$cf_owner_phones"
  [ -n "$cf_yearly_rent" ] && cmd="$cmd CF_YEARLY_RENT_TOTALS_JSON=$cf_yearly_rent"
  [ -n "$cf_lifetime_rent" ] && cmd="$cmd CF_TOTAL_LIFETIME_RENT=$cf_lifetime_rent"
  cmd="$cmd --project-ref bcuwccyyjgmshslnkpyv"
  
  # Execute the command
  eval $cmd
  
  if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to set secrets!${NC}"
    echo "You can set them manually later using:"
    echo "supabase secrets set [KEY=VALUE...] --project-ref bcuwccyyjgmshslnkpyv"
  else
    echo -e "${GREEN}✓ Secrets set successfully${NC}"
  fi
else
  echo "No secrets to set. Skipping this step."
fi

# Step 5: Test the deployed function
echo -e "\n${YELLOW}Step 5: Testing the deployed function...${NC}"
echo "You can test the function with curl:"
echo -e "${GREEN}curl -X POST \"https://bcuwccyyjgmshslnkpyv.functions.supabase.co/sync_leases-ts\" \\"
echo "  -H \"Authorization: Bearer \$SUPABASE_SERVICE_ROLE_KEY\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo -e "  -d '{}'${NC}"

read -p "Would you like to test the function now? (y/n): " test_choice
if [[ $test_choice == "y" || $test_choice == "Y" ]]; then
  # Check if SUPABASE_SERVICE_ROLE_KEY is set
  if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${YELLOW}SUPABASE_SERVICE_ROLE_KEY environment variable not set.${NC}"
    read -p "Enter your Supabase service role key: " service_key
    export SUPABASE_SERVICE_ROLE_KEY=$service_key
  fi
  
  echo "Testing function..."
  curl -X POST \
    "https://bcuwccyyjgmshslnkpyv.functions.supabase.co/sync_leases-ts" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d '{}'
  
  echo -e "\n${GREEN}✓ Test request sent${NC}"
  echo "Check the logs in Supabase Studio for the response"
fi

# Step 6: Final instructions
echo -e "\n${YELLOW}Deployment Complete!${NC}"
echo -e "Your function is now deployed at: ${GREEN}https://bcuwccyyjgmshslnkpyv.functions.supabase.co/sync_leases-ts${NC}"
echo ""
echo "To check logs and monitor your function:"
echo "1. Go to Supabase Studio → Edge Functions → sync_leases-ts → Logs"
echo ""
echo "To test locally before future deployments:"
echo -e "${GREEN}supabase functions serve sync_leases-ts --env-file ./supabase/.env.local${NC}"
echo "Then test with curl or Postman at http://localhost:54321/functions/v1/sync_leases-ts"
echo ""
echo -e "${YELLOW}Troubleshooting:${NC}"
echo "If you see 400 errors in the logs, ensure your custom fields are formatted correctly:"
echo "contact.customField = ["
echo "  { id: Deno.env.get(\"CF_SUPABASE_TENANT_ID\"), value: String(r.id) },"
echo "  // other fields..."
echo "];"
echo ""
echo -e "${GREEN}Happy deploying!${NC}"