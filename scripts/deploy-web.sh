#!/bin/bash
set -e

echo "🌐 Building and deploying to GitHub Pages..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Build web version
echo -e "${BLUE}Building web app...${NC}"
npm run build:web

# Check if dist directory exists
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}No dist directory found. Checking for alternative output...${NC}"
    # Expo might output to different directory
    if [ -d "web-build" ]; then
        mv web-build dist
        echo -e "${BLUE}Moved web-build to dist${NC}"
    else
        echo "❌ No build output found!"
        exit 1
    fi
fi

# Deploy to GitHub Pages
echo -e "${BLUE}Deploying to GitHub Pages...${NC}"
npm run deploy:github

echo -e "${GREEN}✅ Deployed successfully to GitHub Pages!${NC}"
echo -e "${BLUE}Your app will be available at: https://baskervilleAI.github.io/houndtrade${NC}"
