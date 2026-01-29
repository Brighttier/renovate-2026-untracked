#!/bin/bash

# Simple One-Command Deployment Script
# Usage: ./deploy-simple.sh

echo "🚀 Deploying Enhanced Website Generation System"
echo ""

# Check for required tools
command -v npm >/dev/null 2>&1 || { echo "❌ npm is not installed. Install Node.js first."; exit 1; }
command -v gcloud >/dev/null 2>&1 || { echo "❌ gcloud is not installed. Install Google Cloud SDK first."; exit 1; }
command -v firebase >/dev/null 2>&1 || { echo "❌ firebase is not installed. Run: npm install -g firebase-tools"; exit 1; }

# Navigate to project root
cd "$(dirname "$0")"

# Install dependencies
echo "📦 Installing dependencies..."
cd functions && npm install && cd ..

# Enable APIs
echo "🔧 Enabling Google Cloud APIs..."
gcloud services enable vision.googleapis.com aiplatform.googleapis.com

# Grant permissions
echo "🔐 Granting permissions..."
PROJECT_ID=$(gcloud config get-value project)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com" \
  --role="roles/vision.admin" --quiet
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com" \
  --role="roles/storage.objectAdmin" --quiet

# Deploy
echo "🚀 Deploying functions..."
cd functions && npm run deploy

echo ""
echo "✅ DONE! Your system is now lovable.dev quality!"
echo "📝 See QUICK_START.md for testing instructions"
