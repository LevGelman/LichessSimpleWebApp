# Kindle Browser Debugging Guide

## Problem: App Stuck on "Loading..."

If the app is stuck on the "Loading..." screen on your Kindle browser, this guide will help you debug the issue.

## Recent Optimizations (Applied)

The following optimizations have been applied to improve Kindle browser compatibility:

### ✅ 1. **Polyfills Added** (`polyfills.js`)
- **TextEncoder/TextDecoder**: For UTF-8 string encoding/decoding
- **crypto.subtle.digest**: SHA-256 hashing fallback for OAuth PKCE
- **URLSearchParams**: For building query strings
- All polyfills load before the main app

### ✅ 2. **Timeout Handling**
- All `fetch()` calls now have timeouts (10-30 seconds)
- Prevents indefinite hangs on slow/failed network requests
- Shows error messages when timeouts occur

### ✅ 3. **Non-Recursive Stream Reading**
- Replaced recursive promise chains with iterative loops
- Uses `setTimeout(readChunk, 0)` to avoid stack overflow
- Critical for Kindle's limited memory

### ✅ 4. **Better Error Logging**
- Console logs at every major step
- Browser compatibility check on startup
- Detailed error messages shown to user

## How to Debug on Kindle

### Step 1: Enable JavaScript Console (if possible)

Most Kindle browsers don't have a visible console, but errors may appear in the browser itself. Look for any error messages on screen.

### Step 2: Check Browser Compatibility

The app now logs browser compatibility info on startup. If you can access the console (via USB debugging or remote debugging), look for:

```
=== Browser Compatibility Check ===
User Agent: ...
TextEncoder: OK / MISSING (polyfilled)
TextDecoder: OK / MISSING (polyfilled)
crypto.subtle: OK / MISSING (polyfilled)
...
```

### Step 3: Common Issues & Solutions

#### Issue: "Loading..." never completes
**Causes:**
- Network timeout connecting to Lichess
- Polyfills failed to load
- localStorage is disabled

**Solutions:**
1. Check internet connection
2. Try refreshing the page (Ctrl+R or Menu → Refresh)
3. Clear browser cache and cookies
4. Make sure JavaScript is enabled in Kindle browser settings

#### Issue: Login button doesn't work
**Causes:**
- SHA-256 hashing failed
- crypto.subtle polyfill not working

**Solutions:**
1. Check console for "Login failed:" messages
2. Try clearing localStorage: Open browser, go to Settings → Clear Cookies/Cache
3. Restart Kindle browser

#### Issue: Can't connect after OAuth redirect
**Causes:**
- OAuth token exchange timeout
- Network error during token fetch

**Solutions:**
1. Look for "OAuth failed:" error message
2. Try logging in again
3. Check that Lichess.org is accessible from your network

#### Issue: Game stream disconnects frequently
**Causes:**
- Kindle browser kills long-running streams
- Memory limitations

**Solutions:**
- This is a known Kindle limitation
- The app should automatically show "Connection lost" message
- Use the "Back" button and resume the game
- Try using shorter time controls (10+0 instead of 30+0)

### Step 4: Testing Locally

If you want to test locally before deploying:

1. Install a local web server:
   ```bash
   npm install -g http-server
   ```

2. Run the server:
   ```bash
   cd /path/to/LichessSimpleWebApp
   http-server -p 4280
   ```

3. Access from Kindle experimental browser:
   - Go to: `http://YOUR_COMPUTER_IP:4280`
   - Make sure Kindle and computer are on same network

4. Update `config.js` for local testing:
   ```javascript
   REDIRECT_URI: 'http://YOUR_COMPUTER_IP:4280/'
   ```

## Advanced: Remote Debugging

### For Kindle Fire (Android-based):

1. Enable ADB debugging on Kindle Fire
2. Connect via USB to computer
3. Run: `adb forward tcp:9222 localabstract:webview_devtools_remote_####`
4. Open Chrome and go to: `chrome://inspect`
5. Click "Inspect" on the Kindle browser instance

### For Kindle Paperwhite:

Remote debugging is very limited. Best approach:
- Use console.log() statements (already added)
- Look for visual error messages
- Test on desktop browser first to verify functionality

## What Changed in This Update

### Before (Problems):
- ❌ No polyfills → crypto.subtle failed on Kindle
- ❌ No timeouts → requests hung forever
- ❌ Recursive streams → stack overflow on long games
- ❌ Silent failures → no error messages

### After (Fixed):
- ✅ Polyfills for all missing APIs
- ✅ All fetch calls have 10-30s timeouts
- ✅ Iterative stream reading (no recursion)
- ✅ Detailed console logs and error messages
- ✅ Browser compatibility check on startup

## Testing Checklist

Test these scenarios on your Kindle:

- [ ] Page loads and shows login screen (not stuck on "Loading...")
- [ ] Click "Login with Lichess" button works
- [ ] OAuth redirect back to app works
- [ ] Can see lobby with time controls
- [ ] Can seek a game (may take time to find opponent)
- [ ] Game board renders correctly
- [ ] Can make moves by tapping squares
- [ ] Clock counts down
- [ ] Game result shows when game ends
- [ ] Can start a new game

## Fallback: If Nothing Works

If the Kindle browser is too old and nothing works:

1. **Try Lichess mobile site directly**: `https://lichess.org`
   - Their mobile site is very lightweight
   - May work better than a custom app

2. **Use a different device**:
   - Any modern smartphone
   - Tablet
   - Laptop

3. **Report the issue**:
   - Note your Kindle model (e.g., "Paperwhite 2019")
   - Browser version (if visible)
   - Exact error message or behavior
   - Console logs (if accessible)

## Expected Console Output

When working correctly, you should see:

```
Polyfills loaded successfully
Initializing Lichess Kindle app...
=== Browser Compatibility Check ===
[... compatibility info ...]
===================================
Checking authentication...
No existing auth, showing login screen
[User clicks Login]
Starting login...
Hashing code verifier...
Hash complete
[Redirects to Lichess]
[Returns from Lichess]
OAuth callback detected
Exchanging OAuth code for token...
OAuth success
Checking authentication...
Authenticated as: [username]
[Shows lobby]
```

## Contact & Support

This is an unofficial Lichess client. For issues:
- Check Kindle browser version and model
- Try on desktop browser first to verify app works
- File issue with console logs and Kindle model info
