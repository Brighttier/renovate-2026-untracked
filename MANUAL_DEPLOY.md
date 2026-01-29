# Manual Deployment - Copy & Paste Commands

Choose one of these methods to deploy:

---

## 🎯 Method 1: One-Command Deploy (Recommended)

Just run this single command in your terminal:

```bash
cd /Users/khare/Documents/GitHub/renovatemysite2.0 && ./deploy-simple.sh
```

That's it! The script will:
- ✅ Install dependencies
- ✅ Enable APIs
- ✅ Grant permissions
- ✅ Deploy functions

**Time:** 5-8 minutes

---

## 📋 Method 2: Manual Step-by-Step

If you prefer to run each command manually, copy and paste these:

### Step 1: Install Dependencies
```bash
cd /Users/khare/Documents/GitHub/renovatemysite2.0/functions
npm install
```

### Step 2: Enable APIs
```bash
gcloud services enable vision.googleapis.com
gcloud services enable aiplatform.googleapis.com
```

### Step 3: Grant Permissions
```bash
export PROJECT_ID=$(gcloud config get-value project)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com" \
  --role="roles/vision.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

### Step 4: Deploy Functions
```bash
cd /Users/khare/Documents/GitHub/renovatemysite2.0/functions
npm run deploy
```

### Step 5: Verify
```bash
firebase functions:list
firebase functions:log --limit 5
```

---

## ⚡ Method 3: Single Copy-Paste Block

Copy this entire block and paste it into your terminal:

```bash
cd /Users/khare/Documents/GitHub/renovatemysite2.0/functions && \
echo "📦 Installing dependencies..." && \
npm install && \
echo "🔧 Enabling APIs..." && \
gcloud services enable vision.googleapis.com aiplatform.googleapis.com && \
echo "🔐 Granting permissions..." && \
export PROJECT_ID=$(gcloud config get-value project) && \
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com" --role="roles/vision.admin" --quiet && \
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com" --role="roles/storage.objectAdmin" --quiet && \
echo "🚀 Deploying functions..." && \
npm run deploy && \
echo "✅ Done! Check QUICK_START.md for testing"
```

Press Enter and wait 5-8 minutes.

---

## 🧪 Test After Deployment

### Quick Test:
1. Open your app
2. Generate a website for "Dentist" in "Austin, TX"
3. Look for:
   - ✅ Headline: "Get the Smile You've Always Wanted—Pain-Free, Same-Day Results"
   - ✅ NOT: "Welcome to Smith Dental"
   - ✅ CTA: "Get My Free Smile Analysis"
   - ✅ NOT: "Contact Us"
   - ✅ Colors: Blues/greens (trust colors for medical)

### Check Logs:
```bash
firebase functions:log --limit 10 | grep "gemini-2.0-flash-exp"
```

You should see the new model name in the logs.

---

## ❌ Troubleshooting

### "npm: command not found"
Install Node.js:
```bash
# macOS with Homebrew
brew install node

# Or download from: https://nodejs.org/
```

### "gcloud: command not found"
Install Google Cloud SDK:
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init
```

### "firebase: command not found"
Install Firebase CLI:
```bash
npm install -g firebase-tools
firebase login
```

### "Permission denied"
Make scripts executable:
```bash
chmod +x /Users/khare/Documents/GitHub/renovatemysite2.0/*.sh
```

### "Project not found"
Set your project:
```bash
gcloud config set project renovatemysite-app
firebase use renovatemysite-app
```

---

## ✅ Success Checklist

After deployment, verify:

- [ ] `npm install` completed without errors
- [ ] Vision API is enabled (check [Console](https://console.cloud.google.com/apis/api/vision.googleapis.com))
- [ ] Functions deployed successfully (9 functions total)
- [ ] Generated websites have professional copy
- [ ] No placeholder text in generated content
- [ ] Headlines are pain-point focused
- [ ] CTAs are outcome-oriented

---

## 📞 Need Help?

If deployment fails:
1. Run: `firebase functions:log` to see errors
2. Check: [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for detailed troubleshooting
3. Review: [UPGRADE_SUMMARY.md](UPGRADE_SUMMARY.md) for technical details

---

## 🎉 You're Done!

Once deployed, your website generation will immediately produce **lovable.dev-quality results**.

Test it now:
1. Generate a website
2. Be amazed at the quality improvement
3. Show your team! 🚀
