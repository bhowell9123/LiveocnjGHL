#!/bin/bash
# check-ghl-contacts.sh - Wrapper script for verify-ghl-contacts.ts
# Usage: ./check-ghl-contacts.sh [email1] [email2] ...

# Color codes for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}===== GoHighLevel Contact Verification Tool =====${NC}"

# Check if GHL_API_KEY is set
if [ -z "$GHL_API_KEY" ]; then
  echo -e "${YELLOW}GHL_API_KEY environment variable not set.${NC}"
  
  # Check if it's in .env file
  if [ -f ".env" ]; then
    GHL_API_KEY=$(grep "GHL_API_KEY" .env | cut -d'=' -f2)
    if [ -n "$GHL_API_KEY" ]; then
      echo -e "${GREEN}Found GHL_API_KEY in .env file.${NC}"
      export GHL_API_KEY
    fi
  fi
  
  # If still not set, prompt for it
  if [ -z "$GHL_API_KEY" ]; then
    read -p "Enter your GoHighLevel API Key: " api_key
    export GHL_API_KEY=$api_key
  fi
fi

# Check if any emails were provided
if [ $# -eq 0 ]; then
  echo -e "${YELLOW}No email addresses provided.${NC}"
  echo "Usage: ./check-ghl-contacts.sh [email1] [email2] ..."
  echo "Example: ./check-ghl-contacts.sh emily.johnson@example.com"
  
  # Prompt for an email
  read -p "Enter an email address to check: " email
  
  if [ -z "$email" ]; then
    echo -e "${RED}No email provided. Exiting.${NC}"
    exit 1
  fi
  
  # Run the verification script with the provided email
  deno run --allow-net --allow-env verify-ghl-contacts.ts "$email"
else
  # Run the verification script with all provided emails
  deno run --allow-net --allow-env verify-ghl-contacts.ts "$@"
fi

echo -e "\n${YELLOW}Verification complete!${NC}"