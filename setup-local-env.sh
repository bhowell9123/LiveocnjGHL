#!/bin/bash
# setup-local-env.sh - Helper script to set up local environment for testing

# Color codes for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}===== Setting up local environment for sync_leases-ts =====${NC}"

# Check if template exists
if [ ! -f "supabase/.env.local.template" ]; then
  echo -e "${RED}Error: supabase/.env.local.template not found!${NC}"
  echo "Please run this script from the project root directory."
  exit 1
fi

# Check if .env.local already exists
if [ -f "supabase/.env.local" ]; then
  echo -e "${YELLOW}Warning: supabase/.env.local already exists.${NC}"
  read -p "Do you want to overwrite it? (y/n): " overwrite
  if [[ $overwrite != "y" && $overwrite != "Y" ]]; then
    echo "Setup aborted. Your existing .env.local file was not modified."
    exit 0
  fi
fi

# Copy the template
cp supabase/.env.local.template supabase/.env.local
echo -e "${GREEN}✓ Created supabase/.env.local from template${NC}"

# Open the file in the default editor if possible
echo -e "${YELLOW}Now you need to edit the file and add your actual values.${NC}"

if command -v code &> /dev/null; then
  # VSCode is available
  echo "Opening the file in VSCode..."
  code supabase/.env.local
elif [ -n "$EDITOR" ]; then
  # Use the default editor
  echo "Opening the file in your default editor ($EDITOR)..."
  $EDITOR supabase/.env.local
else
  # No editor available, show instructions
  echo -e "Please edit the file ${GREEN}supabase/.env.local${NC} with your text editor"
  echo "and replace the placeholder values with your actual credentials."
fi

echo ""
echo -e "${YELLOW}After setting up your environment variables, you can test locally with:${NC}"
echo -e "${GREEN}supabase functions serve sync_leases-ts --env-file ./supabase/.env.local${NC}"
echo ""
echo -e "Then test with curl or Postman at ${GREEN}http://localhost:54321/functions/v1/sync_leases-ts${NC}"