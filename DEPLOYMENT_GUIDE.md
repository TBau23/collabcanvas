# Firebase Deployment Guide - Figma Clone

## 🚀 Complete Deployment Checklist

Your project includes:
- ✅ React app (Vite) → Firebase Hosting
- ✅ Cloud Functions (AI agent) → Firebase Functions
- ✅ Firestore rules → Firestore Database
- ✅ Realtime Database rules → Realtime Database

---

## 📋 Prerequisites

Before deploying, ensure you have:

1. ✅ Firebase CLI installed globally
   ```bash
   npm install -g firebase-tools
   ```

2. ✅ Logged into Firebase
   ```bash
   firebase login
   ```

3. ✅ Firebase project created (you mentioned hosting is set up)

4. ✅ **CRITICAL**: OpenAI API key configured for Cloud Functions

---

## ⚠️ IMPORTANT: Set Up OpenAI API Key First

Your Cloud Functions need an OpenAI API key to work. Set it using ONE of these methods:

### Option A: Using Firebase Environment Config (Recommended)
```bash
firebase functions:secrets:set OPENAI_API_KEY
```
When prompted, paste your OpenAI API key.

### Option B: Using Firebase Config (Legacy)
```bash
firebase functions:config:set openai.key="your-openai-api-key-here"
```

**Verify it's set:**
```bash
firebase functions:config:get
```

---

## 🚢 Deployment Commands

### Step 1: Install Dependencies

**Install root dependencies:**
```bash
npm install
```

**Install functions dependencies:**
```bash
cd functions
npm install
cd ..
```

---

### Step 2: Build the React App
```bash
npm run build
```

This creates the `dist/` folder with your production-ready React app.

**✅ Verify:** Check that `dist/index.html` exists

---

### Step 3: Deploy Everything to Firebase

**Deploy everything at once (recommended):**
```bash
firebase deploy
```

This deploys:
- React app → Hosting
- Cloud Functions → Functions
- Firestore rules → Firestore
- Realtime Database rules → RTDB

**OR deploy components individually:**

```bash
# Deploy only hosting (React app)
firebase deploy --only hosting

# Deploy only functions (AI agent)
firebase deploy --only functions

# Deploy only Firestore rules
firebase deploy --only firestore:rules

# Deploy only Realtime Database rules
firebase deploy --only database

# Deploy multiple components
firebase deploy --only hosting,functions
```

---

## 📝 Complete Deployment Script (Copy & Paste)

Here's the exact sequence of commands to run from your project root:

```bash
# 1. Make sure you're logged in
firebase login

# 2. Verify you're in the right project
firebase projects:list
firebase use <your-project-id>

# 3. Set OpenAI API key (if not already set)
firebase functions:secrets:set OPENAI_API_KEY

# 4. Install dependencies
npm install
cd functions && npm install && cd ..

# 5. Build the React app
npm run build

# 6. Deploy everything
firebase deploy

# 7. Open your deployed site
firebase open hosting:site
```

---

## 🔍 Post-Deployment Verification

After deployment, verify everything works:

### 1. Check Hosting
```bash
firebase open hosting:site
```
- ✅ Site loads
- ✅ Can login/register
- ✅ Canvas appears

### 2. Check Functions
```bash
firebase functions:log
```
- ✅ AI agent responds to commands
- ✅ No errors in logs

### 3. Check Database Rules
- ✅ Try creating shapes (tests Firestore)
- ✅ Try moving cursor (tests RTDB)
- ✅ Check that unauthenticated users can't access data

### 4. Test AI Agent
- Open AI modal
- Try: "Create a blue rectangle at 500, 500"
- ✅ Shape appears
- ✅ No errors in console

---

## 🐛 Common Issues & Solutions

### Issue: "Error: HTTP Error: 400, Billing account not configured"
**Solution:** Enable billing on your Firebase project (required for Cloud Functions)
```bash
firebase open billing
```

### Issue: "Error: Missing required configuration"
**Solution:** Make sure OpenAI API key is set:
```bash
firebase functions:secrets:set OPENAI_API_KEY
```

### Issue: "Functions deploy fails with Node version error"
**Solution:** Your functions require Node 22. Update locally or in Firebase:
```bash
# Check your local Node version
node --version

# Should be 22.x.x
```

### Issue: "Hosting shows old version"
**Solution:** Clear cache and rebuild:
```bash
npm run build
firebase deploy --only hosting
# Then hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
```

### Issue: "AI agent doesn't work after deployment"
**Solution:** Check that OpenAI key is set and functions deployed:
```bash
firebase functions:config:get
firebase functions:log --limit 50
```

---

## 🔄 Continuous Deployment Workflow

For ongoing development:

### Quick Update (after code changes):
```bash
# If you changed React code:
npm run build && firebase deploy --only hosting

# If you changed Cloud Functions:
firebase deploy --only functions

# If you changed both:
npm run build && firebase deploy --only hosting,functions
```

### Update Database Rules:
```bash
# After editing firestore.rules or database.rules.json:
firebase deploy --only firestore:rules,database
```

---

## 📊 Monitoring Your Deployment

### View Logs
```bash
# Functions logs (for AI agent)
firebase functions:log

# Follow logs in real-time
firebase functions:log --follow

# Filter specific function
firebase functions:log --only callAI
```

### Check Usage
```bash
# Open Firebase Console
firebase open

# Or directly open sections:
firebase open hosting     # Hosting dashboard
firebase open functions   # Functions dashboard
firebase open database    # Databases
```

---

## 💰 Cost Considerations

Your project uses:

1. **Hosting**: Free tier usually sufficient (10 GB storage, 360 MB/day transfer)
2. **Firestore**: Pay-as-you-go (free tier: 50K reads, 20K writes/day)
3. **Realtime Database**: Pay-as-you-go (free tier: 100 simultaneous connections)
4. **Cloud Functions**: **Requires Blaze (pay-as-you-go) plan**
5. **OpenAI API**: Separate billing (GPT-4o-mini is very affordable)

**Recommended:** Set up budget alerts in Firebase Console

---

## 🔐 Security Checklist

Before going to production:

- [ ] OpenAI API key stored as secret (not in code)
- [ ] Firestore rules deployed and tested
- [ ] Realtime Database rules deployed and tested
- [ ] Firebase Authentication enabled
- [ ] Budget alerts configured
- [ ] Test with unauthenticated users to verify they can't access data

---

## 🎯 Quick Command Reference

```bash
# Login
firebase login

# Select project
firebase use <project-id>

# Build React app
npm run build

# Deploy everything
firebase deploy

# Deploy specific components
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only database

# View logs
firebase functions:log

# Open deployed site
firebase open hosting:site

# Check what will be deployed
firebase deploy --dry-run
```

---

## ✅ Success Checklist

Your deployment is successful when:

- [ ] Site loads at your Firebase hosting URL
- [ ] Users can register and login
- [ ] Canvas appears and shapes can be created
- [ ] Cursor movements are visible to other users
- [ ] AI agent responds to commands
- [ ] Shapes created by AI appear on canvas
- [ ] No errors in browser console
- [ ] No errors in `firebase functions:log`

---

## 🆘 Need Help?

If you encounter issues:

1. **Check logs**: `firebase functions:log`
2. **Check browser console**: F12 / Cmd+Option+I
3. **Verify build**: Ensure `dist/` folder exists with index.html
4. **Check Firebase Console**: firebase.google.com/project/_/overview
5. **Verify API keys**: OpenAI key must be set for AI agent to work

---

Good luck with your deployment! 🚀

