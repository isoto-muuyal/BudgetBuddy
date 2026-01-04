#!/bin/bash

# Deployment script for EC2 instance
# This script can be run manually on the EC2 instance or called from GitHub Actions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration (can be overridden by environment variables)
APP_DIR="${EC2_APP_DIR:-/home/ubuntu/BudgetBuddy}"
PM2_APP_NAME="${PM2_APP_NAME:-budgetbuddy}"
BRANCH="${BRANCH:-main}"

echo -e "${GREEN}Starting deployment...${NC}"

# Navigate to app directory
cd "$APP_DIR" || {
  echo -e "${RED}Error: Could not navigate to $APP_DIR${NC}"
  exit 1
}

# Pull latest code
echo -e "${YELLOW}Pulling latest code from $BRANCH...${NC}"
git fetch origin
git reset --hard "origin/$BRANCH"

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm ci --production=false

# Build application
echo -e "${YELLOW}Building application...${NC}"
npm run build

# Restart PM2 application
echo -e "${YELLOW}Restarting PM2 application...${NC}"
if pm2 list | grep -q "$PM2_APP_NAME"; then
  pm2 restart "$PM2_APP_NAME"
else
  echo -e "${YELLOW}Application not found in PM2, starting it...${NC}"
  pm2 start npm --name "$PM2_APP_NAME" -- start
fi

# Save PM2 configuration
pm2 save

# Show status
echo -e "${GREEN}Deployment completed!${NC}"
echo -e "${YELLOW}PM2 Status:${NC}"
pm2 status "$PM2_APP_NAME"

echo -e "${YELLOW}Recent logs:${NC}"
pm2 logs "$PM2_APP_NAME" --lines 20 --nostream

