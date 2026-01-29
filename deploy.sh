#!/bin/bash

# Deployment Script for Enhanced Website Generation System
# This script deploys all upgrades including Gemini 2.0, Vision API, and Imagen 3

set -e  # Exit on any error

echo "🚀 Starting deployment of enhanced website generation system..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Install Dependencies
echo "${YELLOW}Step 1/5: Installing dependencies...${NC}"
cd functions
npm install
echo "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 2: Enable Google Cloud APIs
echo "${YELLOW}Step 2/5: Enabling Google Cloud APIs...${NC}"
gcloud services enable vision.googleapis.com
echo "${GREEN}✓ Vision API enabled${NC}"

gcloud services enable aiplatform.googleapis.com
echo "${GREEN}✓ Vertex AI enabled${NC}"
echo ""

# Step 3: Grant Service Account Permissions
echo "${YELLOW}Step 3/5: Granting service account permissions...${NC}"
PROJECT_ID=$(gcloud config get-value project)
SERVICE_ACCOUNT="$PROJECT_ID@appspot.gserviceaccount.com"

echo "Using project: $PROJECT_ID"
echo "Service account: $SERVICE_ACCOUNT"
echo ""

# Grant Vision API permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/vision.admin" \
  --quiet

echo "${GREEN}✓ Vision API permissions granted${NC}"

# Grant Storage permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/storage.objectAdmin" \
  --quiet

echo "${GREEN}✓ Storage permissions granted${NC}"
echo ""

# Step 4: Deploy Cloud Functions
echo "${YELLOW}Step 4/5: Deploying Cloud Functions...${NC}"
echo "This may take 3-5 minutes..."
echo ""

npm run deploy

echo ""
echo "${GREEN}✓ Functions deployed successfully${NC}"
echo ""

# Step 5: Verify Deployment
echo "${YELLOW}Step 5/5: Verifying deployment...${NC}"
firebase functions:list

echo ""
echo "${GREEN}========================================${NC}"
echo "${GREEN}✅ DEPLOYMENT COMPLETE!${NC}"
echo "${GREEN}========================================${NC}"
echo ""
echo "📊 Deployment Summary:"
echo "  • Model upgraded: Gemini 1.5 Flash → Gemini 2.0 Flash"
echo "  • Enhanced prompts: lovable.dev quality"
echo "  • New functions deployed:"
echo "    - extractLogo (Vision API)"
echo "    - createLogo (Imagen 3)"
echo "    - uploadLogo (Storage)"
echo ""
echo "🧪 Quick Test:"
echo "  1. Generate a website for any business"
echo "  2. Look for:"
echo "     ✓ Pain-point headlines (not 'Welcome to...')"
echo "     ✓ Outcome CTAs ('Get My Free Quote' not 'Contact Us')"
echo "     ✓ Industry-appropriate colors"
echo "     ✓ NO placeholder text"
echo ""
echo "📚 Documentation:"
echo "  • Quick Start: QUICK_START.md"
echo "  • Full Details: UPGRADE_SUMMARY.md"
echo "  • Comparison: BEFORE_AFTER_COMPARISON.md"
echo ""
echo "🎉 Your website generation is now lovable.dev quality!"
echo ""

# Check logs for any issues
echo "${YELLOW}Recent function logs:${NC}"
firebase functions:log --limit 5
