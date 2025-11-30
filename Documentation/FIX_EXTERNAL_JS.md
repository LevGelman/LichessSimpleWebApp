# Fix: External JavaScript Files Not Loading on Kindle

## Problem Identified

**Debug output shows:** "JavaScript is working!" but nothing else appears.

**Root Cause:** Kindle browser can execute inline JavaScript, but **external .js files (polyfills.js, config.js, app.js) are not loading**.

## Possible Reasons

1. **Azure Static Web Apps routing issue** - The `navigationFallback` was rewriting ALL requests (including .js files) to index.html
2. **MIME type not set** - Azure wasn't serving .js files with correct `Content-Type: text/javascript` header
3. **Kindle browser restrictions** - Very old Kindle browsers may block external scripts

## Solutions Applied

### Solution 1: Fix Azure Configuration ✅

**File:** `staticwebapp.config.json`

**Changes:**
```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["*.js", "*.css", "*.json", "*.svg", "*.png", "*.jpg"]  // ADDED
  },
  "mimeTypes": {
    ".js": "text/javascript",      // ADDED
    ".json": "application/json",
    ".css": "text/css",            // ADDED
    ".html": "text/html"           // ADDED
  }
}
```

**Why this helps:**
- **navigationFallback.exclude** - Prevents Azure from redirecting polyfills.js → index.html
- **mimeTypes** - Ensures .js files are served with correct Content-Type header

### Solution 2: Test File Created

**File:** `index-standalone.html`

This file dynamically loads scripts and shows detailed error messages if they fail.

**How to use:**
1. Rename current `index.html` to `index-original.html`
2. Rename `index-standalone.html` to `index.html`
3. Deploy and check debug output

## Next Steps

### Step 1: Deploy the Azure Config Fix

```bash
git add staticwebapp.config.json
git commit -m "Fix Azure routing: exclude JS/CSS from navigationFallback"
git push origin main
```

Wait 2 minutes for deployment, then test on Kindle.

### Step 2: Check Debug Output

You should now see:
```
[10:30:15] ✓ JavaScript working
[10:30:15] Loading polyfills...
[10:30:16] ✓ Loaded: polyfills.js        ← This should appear now!
[10:30:16] ✓ Loaded: config.js
[10:30:16] ✓ Loaded: app.js
[10:30:16] All files loaded successfully!
[10:30:16] >>> app.js loading...
[10:30:16] ✓ Polyfills loaded successfully
[10:30:16] === APP LOADING ===
... etc
```

**If you still see only "JavaScript working":**
- Azure config didn't help
- Kindle browser is blocking ALL external scripts
- Need to bundle everything inline (see Solution 3)

### Step 3: If Still Failing - Bundle Everything Inline

Create a single HTML file with all JavaScript embedded:

```bash
# Concatenate all JS into one inline script
cat polyfills.js config.js app.js > bundle.js

# Then manually copy bundle.js content into index.html <script> tags
```

Or use the build script I'll create...

## Verification Commands

### Check if files are accessible

On your computer (not Kindle), try accessing:
```
https://your-app.azurestaticapps.net/polyfills.js
https://your-app.azurestaticapps.net/config.js
https://your-app.azurestaticapps.net/app.js
```

**Expected:** Should show JavaScript code, NOT redirect to index.html
**Content-Type header:** Should be `text/javascript`

### Check Azure deployment

```bash
# After pushing, check deployment status
gh browse
# or visit: https://portal.azure.com
```

## Common Issues

### Issue 1: Azure still redirecting .js to index.html

**Symptoms:** Accessing polyfills.js shows HTML instead of JavaScript
**Fix:** Make sure staticwebapp.config.json has the `exclude` array
**Verify:** Check file is committed and deployed

### Issue 2: CORS or CSP blocking scripts

**Symptoms:** Browser console shows CORS error
**Fix:** Add to staticwebapp.config.json:
```json
"globalHeaders": {
  "Access-Control-Allow-Origin": "*",
  "Content-Security-Policy": "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://lichess.org; script-src 'self' 'unsafe-inline' 'unsafe-eval'"
}
```

### Issue 3: Cache preventing updates

**Symptoms:** Changes don't appear after deployment
**Fix:** Hard refresh on Kindle (usually Menu → Refresh)
**Or:** Add cache-busting query param:
```html
<script src="polyfills.js?v=2"></script>
```

## Quick Test (Desktop)

Before testing on Kindle:

1. Open browser DevTools (F12)
2. Go to Network tab
3. Load your Azure URL
4. Check for polyfills.js, config.js, app.js requests
5. Verify Status: 200 (not 301/302 redirect)
6. Verify Content-Type: text/javascript

## Expected Timeline

- **Immediately after fix:** Desktop browsers should work
- **2-5 minutes:** Azure deployment completes
- **First Kindle load:** May need cache clear
- **Subsequent loads:** Should work instantly

## If Azure Config Fix Works

You'll see the full debug output showing all initialization steps, and the app will transition from "Loading..." to "Login with Lichess" screen within 2-3 seconds.

## If Azure Config Fix Doesn't Work

We'll need to create a fully inline version where ALL JavaScript is embedded directly in index.html. This is the ultimate fallback for very restrictive browsers.

---

**TL;DR:** The issue is Azure was redirecting `.js` file requests to `index.html`. The fix excludes static files from navigation fallback and sets correct MIME types.

**Deploy this fix now and check if polyfills.js loads!**
