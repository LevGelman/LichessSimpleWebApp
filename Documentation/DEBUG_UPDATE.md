# On-Screen Debug Mode - Update

## Problem
The app is still stuck on "Loading..." on Kindle browser, and there's no way to see console logs or debug information.

## Solution
Added **on-screen debug logging** that shows all console output directly on the loading screen.

## What Changed

### 1. On-Screen Debug Log Display

**Files Modified:**
- [index.html](index.html#L17) - Added `<div id="debug-log">` to loading screen
- [style.css](style.css#L406-L435) - Added styling for debug log
- [app.js](app.js#L9-L71) - Added debug logger that overrides console

**What You'll See:**
```
Loading...
┌─────────────────────────────────────────┐
│ 10:30:15 JavaScript is working!         │
│ 10:30:15 ✓ Polyfills loaded            │
│ 10:30:15 >>> app.js loading...         │
│ 10:30:16 === APP LOADING ===           │
│ 10:30:16 DOM state: loading            │
│ 10:30:16 Waiting for DOM...            │
│ 10:30:16 DOM ready, starting init      │
│ 10:30:16 Initializing Lichess...       │
│ 10:30:16 === Browser Compatibility === │
│ 10:30:16 TextEncoder: OK                │
│ 10:30:16 crypto.subtle: OK              │
│ ... etc ...                             │
└─────────────────────────────────────────┘
```

**Errors show in bold:**
```
│ 10:30:17 ❌ CRITICAL: Init failed      │
│ 10:30:17 Error: Cannot read property   │
```

### 2. Enhanced Error Catching

Added multiple error handlers:
- Global `window.onerror` - catches all JS errors
- `window.unhandledrejection` - catches promise rejections
- Try-catch around init function
- Try-catch around DOM ready listener

### 3. Step-by-Step Logging

Added console.log at every critical point:
1. ✅ JavaScript execution starts
2. ✅ Polyfills load
3. ✅ app.js loads
4. ✅ DOM ready
5. ✅ Init starts
6. ✅ Browser compatibility check
7. ✅ Event handlers setup
8. ✅ Auth check starts
9. ✅ Screen transition (loading → login/lobby)

**The logs will show EXACTLY where it gets stuck!**

## How to Use

### Step 1: Deploy and Open on Kindle

```bash
git add .
git commit -m "Add on-screen debug logging for Kindle"
git push origin main
```

Wait 2 minutes for Azure to deploy, then open on Kindle.

### Step 2: Read the Debug Output

Look at the loading screen. You should see messages appearing in the debug log box.

**Scenario A: Nothing appears (blank debug log)**
- **Meaning:** JavaScript is completely disabled or blocked
- **Fix:** Enable JavaScript in Kindle browser settings

**Scenario B: Only "JavaScript is working!" appears**
- **Meaning:** Inline script works, but external files (polyfills.js, app.js) failed to load
- **Fix:** Check file paths, check network, check Content Security Policy

**Scenario C: Messages appear but stop at specific line**
- **Meaning:** That's where it's crashing!
- **Example:** If last message is "Hashing code verifier..." then SHA-256 polyfill failed

**Scenario D: All messages appear including "showing login screen"**
- **Meaning:** App works! Should transition from loading to login
- **If stuck:** Likely a CSS issue with `.hidden` class

### Step 3: Report What You See

Take a photo of the Kindle screen showing the debug log, or copy the last few lines. This will tell us exactly what's wrong.

## Common Debug Patterns

### Pattern: Stops at "Checking authentication"
```
10:30:16 Checking for existing auth...
10:30:16 Checking authentication...
[STOPS HERE - no more messages]
```
**Diagnosis:** Network request timeout or fetch API failure
**Next Step:** Check if Lichess.org is accessible from Kindle

### Pattern: Stops at "Hashing code verifier"
```
10:30:16 Starting login...
10:30:16 Hashing code verifier...
[STOPS HERE]
```
**Diagnosis:** SHA-256 polyfill failed or async/await not working
**Next Step:** Browser too old, may need XMLHttpRequest fallback

### Pattern: Shows "showing login screen" but stays on loading
```
10:30:16 No existing auth, showing login screen
[But still shows "Loading..." on screen]
```
**Diagnosis:** CSS issue - `.hidden` class not working or `showScreen()` failed
**Next Step:** Check CSS file loaded, check querySelector support

### Pattern: Error message appears
```
10:30:17 ❌ Global error: Cannot read property 'getReader' of undefined
```
**Diagnosis:** ReadableStream not supported (very old browser)
**Next Step:** Need fallback for streaming

## Testing Locally

To test the debug logger on desktop first:

```bash
cd /path/to/LichessSimpleWebApp
python3 -m http.server 4280
```

Open http://localhost:4280 in a desktop browser. You should see the debug log appear and quickly transition to login screen (within 2-3 seconds).

**In desktop browser's console**, you'll see both:
1. Regular console output (in browser DevTools)
2. On-screen debug output (in the debug-log div)

## Worst Case Scenarios

### If you see NOTHING (no debug output at all)

This means one of:
1. **JavaScript completely disabled** - Enable in Kindle settings
2. **CSP blocking inline scripts** - Check staticwebapp.config.json
3. **Page didn't load at all** - Check internet connection
4. **Kindle browser too old** (pre-2010) - Can't support this browser

### If it crashes before showing anything

The inline script in index.html runs FIRST. If that doesn't show anything:
- HTML didn't parse correctly
- JavaScript is blocked at system level
- Browser incompatibility (extremely old)

## Files Modified

1. **index.html** (+9 lines)
   - Added inline script to test JavaScript immediately
   - Added debug-log div to loading screen

2. **style.css** (+36 lines)
   - Added styles for debug log display

3. **app.js** (+80 lines)
   - Added debugLog() function
   - Override console.log, console.error, console.warn
   - Added global error handlers
   - Added extensive logging throughout init flow
   - Added try-catch wrappers

4. **polyfills.js** (+5 lines)
   - Added window.POLYFILLS_LOADED marker
   - Added console log when loaded

## Next Steps

1. **Deploy this update**
2. **Open on Kindle browser**
3. **Look at the debug log on screen**
4. **Report the last message you see**

With this information, we can pinpoint the EXACT line where it fails and create a targeted fix.

## Quick Test

To verify debug logging works:

1. Open app on any browser
2. Should see debug messages appear on loading screen
3. Should transition to login screen after 1-3 seconds
4. Debug log should show final message: "No existing auth, showing login screen"

If this works on desktop, the SAME debug output will appear on Kindle, showing us exactly where it fails!
