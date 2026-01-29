# Deployment Checklist ✅

## Pre-Deployment (5 minutes)

### 1. Install Dependencies
```bash
cd functions
npm install
```

**Expected output:**
```
✓ @google-cloud/storage@7.14.0
✓ @google-cloud/vision@4.3.2
```

### 2. Enable Google Cloud APIs
```bash
# Enable Vision API (for logo extraction)
gcloud services enable vision.googleapis.com

# Enable Vertex AI (for future Imagen 3 integration)
gcloud services enable aiplatform.googleapis.com
```

**Verify:**
```bash
gcloud services list --enabled | grep -E "vision|aiplatform"
```

### 3. Grant Service Account Permissions
```bash
# Get your project ID
export PROJECT_ID=$(gcloud config get-value project)

# Find your default service account
gcloud iam service-accounts list

# Grant Vision API access
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com" \
  --role="roles/vision.admin"

# Grant Storage access (for logo uploads)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

---

## Deployment

### 4. Deploy Cloud Functions
```bash
cd functions
npm run deploy
```

**This will deploy:**
- ✓ `findBusinesses` (updated: Gemini 2.0 Flash)
- ✓ `generateBlueprint` (updated: Enhanced prompts)
- ✓ `editBlueprint` (updated: Enhanced prompts)
- ✓ `generateImage` (unchanged)
- ✓ `extractLogo` (NEW: Vision API)
- ✓ `createLogo` (NEW: Imagen 3 ready)
- ✓ `uploadLogo` (NEW: Logo storage)

**Expected deploy time:** 2-5 minutes

---

## Post-Deployment Testing

### 5. Test Enhanced Blueprint Generation

**In your app:**
1. Select a business category (e.g., "Dentist")
2. Select a location (e.g., "Austin, TX")
3. Generate a website

**Verify quality improvements:**
- [ ] Headline addresses a pain point (NOT "Welcome to...")
- [ ] CTA is outcome-focused ("Get My Free Consultation" NOT "Contact Us")
- [ ] Service descriptions focus on benefits, not features
- [ ] Colors match industry (blues for medical, greens for fitness, etc.)
- [ ] NO placeholder text anywhere
- [ ] Sections in order: hero → services → services → services → trust → contact

### 6. Test Vision API (Optional - Logo Extraction)

**Using curl:**
```bash
# Replace with your region and project ID
export REGION="us-central1"
export PROJECT_ID="renovatemysite-app"

curl -X POST https://$REGION-$PROJECT_ID.cloudfunctions.net/extractLogo \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://example.com/business-logo.jpg",
    "businessName": "Test Business"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "logo": {
    "url": "https://storage.googleapis.com/...",
    "description": "Business Logo",
    "confidence": 0.95
  },
  "brandColors": [
    { "hex": "#0EA5E9", "score": 0.8 },
    { "hex": "#10B981", "score": 0.6 }
  ],
  "extractionMethod": "vision-api"
}
```

### 7. Test Imagen 3 Placeholder

**Using curl:**
```bash
curl -X POST https://$REGION-$PROJECT_ID.cloudfunctions.net/createLogo \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Austin Fitness Co",
    "category": "Gym",
    "colorScheme": ["#22C55E", "#18181B"],
    "style": "modern"
  }'
```

**Expected response:**
```json
{
  "logos": [
    {
      "prompt": "Professional gym logo...",
      "option": 1,
      "placeholder": true,
      "backgroundColor": "#22C55E"
    }
  ],
  "imagenPrompt": "Professional gym logo featuring...",
  "generationMethod": "imagen-3-ready",
  "note": "Imagen 3 integration ready..."
}
```

---

## Verification Checklist

After deployment, verify:

### Backend (Cloud Functions)
- [ ] `generateBlueprint` uses Gemini 2.0 Flash (check logs)
- [ ] New functions deployed: `extractLogo`, `createLogo`, `uploadLogo`
- [ ] No errors in deployment output
- [ ] Functions logs show successful executions

### Frontend (Website Quality)
- [ ] Headlines are compelling and specific
- [ ] CTAs use outcome language
- [ ] Copy is benefit-driven, not feature-focused
- [ ] Colors match industry psychology
- [ ] No "lorem ipsum" or placeholder text
- [ ] Logo renders in hero section (if `logoUrl` is present)

### APIs Enabled
- [ ] Vision API enabled: `gcloud services list --enabled | grep vision`
- [ ] Vertex AI enabled: `gcloud services list --enabled | grep aiplatform`

### Permissions
- [ ] Service account has `roles/vision.admin`
- [ ] Service account has `roles/storage.objectAdmin`

---

## Troubleshooting

### ❌ "Failed to deploy function"
```bash
# Check for TypeScript errors
cd functions
npx tsc --noEmit

# Check for missing dependencies
npm install

# Try deploying single function
firebase deploy --only functions:generateBlueprint
```

### ❌ "Vision API not enabled"
```bash
# Enable the API
gcloud services enable vision.googleapis.com

# Verify it's enabled
gcloud services list --enabled | grep vision
```

### ❌ "Permission denied" errors
```bash
# Check current service account
gcloud config get-value account

# Grant permissions manually in Console:
# 1. Go to IAM & Admin > IAM
# 2. Find your service account
# 3. Click "Edit"
# 4. Add roles: "Cloud Vision Admin", "Storage Object Admin"
```

### ❌ "Blueprint still has placeholders"
This means the enhanced prompts aren't being used:
1. Check logs: `firebase functions:log`
2. Verify model name: Should be `gemini-2.0-flash-exp`
3. Redeploy: `firebase deploy --only functions:generateBlueprint`

---

## Success Criteria ✅

You'll know it's working when:

1. **Generated websites look professional** - Like lovable.dev quality
2. **Headlines grab attention** - Pain-point focused, not generic
3. **CTAs are actionable** - "Get My Free Quote" not "Contact Us"
4. **Colors make sense** - Blues for medical, greens for fitness
5. **No placeholder text** - Everything is final-ready
6. **Logo extraction works** - Can extract logos from business photos
7. **Team is happy** - Quality matches or exceeds expectations

---

## Cost Monitoring

After deployment, monitor costs:

```bash
# View Cloud Functions usage
gcloud logging read "resource.type=cloud_function" \
  --limit 50 \
  --format json

# Check Vision API usage
gcloud logging read "resource.type=vision.googleapis.com" \
  --limit 50 \
  --format json
```

**Expected costs per website:**
- Blueprint generation: ~$0.02-0.05
- Logo extraction: ~$0.0015
- Logo generation (when Imagen 3 is active): ~$0.03
- **Total**: ~$0.05-0.14 per website

---

## Next Steps After Successful Deployment

### Optional UI Enhancements:
1. **Add branding step to wizard**
   - File: `/App.tsx`
   - Add step between "Select Business" and "AI Creating"
   - Allow upload existing logo OR generate new logo

2. **Create logo selector component**
   - File: `/components/LogoSelector.tsx` (new)
   - Display 3 generated logo options
   - Let user select preferred option

3. **Complete Imagen 3 integration**
   - File: `/functions/src/imagen/logoGenerator.ts`
   - Replace placeholder with actual Vertex AI API calls
   - See comments in file for integration points

### Share with Team:
- [QUICK_START.md](./QUICK_START.md) - Quick overview
- [UPGRADE_SUMMARY.md](./UPGRADE_SUMMARY.md) - Technical details
- This checklist for future deployments

---

## Rollback Plan (If Needed)

If something goes wrong:

```bash
# View recent deployments
firebase functions:list

# Rollback to previous version
# (Note: Firebase doesn't have built-in rollback, need to redeploy old code)

# Quick fix: Change model back to 1.5 Flash
# Edit: functions/src/gemini/index.ts
# Change: gemini-2.0-flash-exp -> gemini-1.5-flash
# Deploy: npm run deploy
```

---

## ✅ All Done!

Your website generation is now **lovable.dev quality**.

Questions? Check:
- [QUICK_START.md](./QUICK_START.md)
- [UPGRADE_SUMMARY.md](./UPGRADE_SUMMARY.md)
- [Cloud Functions Logs](https://console.firebase.google.com/project/_/functions/logs)
