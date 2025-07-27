#!/bin/bash
# test-function.sh - Test the sync_leases-ts function locally or in production

# Color codes for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}===== Testing sync_leases-ts Supabase Edge Function =====${NC}"

# Function to test local deployment
test_local() {
  echo -e "\n${YELLOW}Testing local function...${NC}"
  echo "Ensure you have the function running locally with:"
  echo -e "${GREEN}supabase functions serve sync_leases-ts --env-file ./supabase/.env.local${NC}"
  
  echo -e "\nSending test request to local function..."
  curl -X POST \
    "http://localhost:54321/functions/v1/sync_leases-ts" \
    -H "Content-Type: application/json" \
    -d '{}'
  
  echo -e "\n\n${GREEN}✓ Test request sent to local function${NC}"
}

# Function to test production deployment
test_production() {
  echo -e "\n${YELLOW}Testing production function...${NC}"
  
  # Check if SUPABASE_SERVICE_ROLE_KEY is set
  if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${YELLOW}SUPABASE_SERVICE_ROLE_KEY environment variable not set.${NC}"
    read -p "Enter your Supabase service role key: " service_key
    export SUPABASE_SERVICE_ROLE_KEY=$service_key
  fi
  
  echo -e "Sending test request to production function..."
  curl -X POST \
    "https://bcuwccyyjgmshslnkpyv.functions.supabase.co/sync_leases-ts" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d '{}'
  
  echo -e "\n\n${GREEN}✓ Test request sent to production function${NC}"
  echo "Check the logs in Supabase Studio for the response"
}

# Main menu
echo "Select an environment to test:"
echo "1) Local (http://localhost:54321)"
echo "2) Production (https://bcuwccyyjgmshslnkpyv.functions.supabase.co)"
echo "3) Exit"

read -p "Enter your choice (1-3): " choice

case $choice in
  1)
    test_local
    ;;
  2)
    test_production
    ;;
  3)
    echo "Exiting..."
    exit 0
    ;;
  *)
    echo -e "${RED}Invalid choice. Exiting.${NC}"
    exit 1
    ;;
esac

echo -e "\n${YELLOW}Testing complete!${NC}"
echo "If you encountered any issues, check the troubleshooting section in the README.md"