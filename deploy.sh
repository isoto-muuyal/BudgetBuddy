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
APP_DIR="/home/ubuntu/workspace/BudgetBuddy"
BRANCH="main"

echo -e "${GREEN}Starting deployment...${NC}"

# 1. Navigate to app directory
cd "$APP_DIR" || {
  echo -e "${RED}Error: Could not navigate to $APP_DIR${NC}"
  exit 1
}

# 2. Pull latest code
echo -e "${YELLOW}Pulling latest code from $BRANCH...${NC}"
git fetch origin
git reset --hard "origin/$BRANCH"

# 3. Handle shared network (ensure it exists)
docker network create shared_network 2>/dev/null || true

# 4. Build and Restart with Docker Compose
echo -e "${YELLOW}Building and restarting containers...${NC}"
# --build ensures the Dockerfile is re-read for code changes
# -d runs it in the background
docker compose up -d --build

# 5. Cleanup (Professional Move)
# This removes old "dangling" images to save space on your EC2
echo -e "${YELLOW}Cleaning up old images...${NC}"
docker image prune -f

# 6. Show status
echo -e "${GREEN}Deployment completed!${NC}"
docker ps --filter "name=budgetbuddy_app"

