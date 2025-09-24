#!/bin/bash
set -e

echo "🚀 Building HoundTrade for all platforms..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if logged into Expo
echo -e "${BLUE}Checking Expo authentication...${NC}"
if ! npx expo whoami > /dev/null 2>&1; then
    echo -e "${YELLOW}Please login to Expo first:${NC}"
    echo "npx expo login"
    exit 1
fi

# Build Web App
echo -e "${BLUE}📱 Building Web App for GitHub Pages...${NC}"
npm run build:web
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Web build completed successfully!${NC}"
else
    echo -e "${RED}❌ Web build failed!${NC}"
    exit 1
fi

# Build Android
echo -e "${BLUE}🤖 Building Android APK...${NC}"
npx eas build --platform android --profile production-apk --non-interactive
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Android build completed successfully!${NC}"
else
    echo -e "${RED}❌ Android build failed!${NC}"
fi

# Build iOS
echo -e "${BLUE}🍎 Building iOS App...${NC}"
npx eas build --platform ios --profile production --non-interactive
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ iOS build completed successfully!${NC}"
else
    echo -e "${RED}❌ iOS build failed!${NC}"
fi

echo -e "${GREEN}🎉 All builds completed! Check EAS dashboard for download links.${NC}"
echo -e "${BLUE}Web app will be deployed to: https://baskervilleAI.github.io/houndtrade${NC}"
