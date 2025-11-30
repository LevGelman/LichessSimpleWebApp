#!/bin/bash
# Create final working version

# Start with the HTML from test version, replace screens, add all JS

cat > index.html << 'HTMLSTART'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=no, user-scalable=no">
    <meta name="color-scheme" content="light">
    <title>Lichess - Kindle</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
<style>
HTMLSTART

# Add ALL CSS
cat style.css >> index.html

cat >> index.html << 'HTMLMID'
</style>
</head>
<body>
<div id="app">
HTMLMID

# Extract just the screens from index-inline.html (lines with screen divs)
grep -A 200 '<div id="screen-loading"' index-inline.html | grep -B 200 '</div>.*app' | head -n -1 >> index.html

cat >> index.html << 'HTMLSCRIPT'
</div>

<script>
// Working debug logger
(function() {
    var debugDiv = document.getElementById('debug-log');
    var logs = [];
    var logCount = 0;

    window.log = function(msg, isError) {
        logCount++;
        var time = new Date().toLocaleTimeString();
        var text = logCount + '. [' + time + '] ' + msg;
        logs.push({ text: text, isError: isError });
        if (logs.length > 100) logs.shift();

        if (debugDiv) {
            var html = '';
            for (var i = 0; i < logs.length; i++) {
                html += '<div>' + logs[i].text + '</div>';
            }
            debugDiv.innerHTML = html;
            debugDiv.scrollTop = debugDiv.scrollHeight;
        }
        // Also use console if available
        try {
            if (window.console) {
                if (isError && console.error) console.error(text);
                else if (console.log) console.log(text);
            }
        } catch(e) {}
    };

    window.onerror = function(msg, url, line) {
        log('ERROR: ' + msg + ' at line ' + line, true);
        return true;
    };

    log('App loading...');
})();

HTMLSCRIPT

# Add polyfills
cat polyfills.js | tail -n +4 >> index.html

echo "" >> index.html
echo "// Config" >> index.html
cat config.js >> index.html

echo "" >> index.html
echo "// App - with log() instead of console" >> index.html

# Add app but replace console.log with log()
cat app.js | \
  grep -v "^console.log = function" | \
  grep -v "^console.error = function" | \
  grep -v "^console.warn = function" | \
  grep -v "^const originalConsole" | \
  grep -v "function debugLog" | \
  grep -v "function updateDebugDisplay" | \
  sed 's/console\.log(/log(/g' | \
  sed 's/console\.error(/log(/g' | \
  sed 's/console\.warn(/log(/g' >> index.html

cat >> index.html << 'HTMLEND'
</script>
</body>
</html>
HTMLEND

echo "Created index.html"
ls -lh index.html
wc -l index.html
