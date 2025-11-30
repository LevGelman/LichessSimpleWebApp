#!/usr/bin/env python3
# Add ultra-detailed diagnostics to index.html for Kindle

with open('index.html', 'r') as f:
    html = f.read()

# Find the simple logger and replace it with a more robust version
old_logger = '''// Simple working logger
(function() {
    var debugDiv = document.getElementById('debug-log');
    var logs = [];
    var count = 0;

    window.log = function(msg, isError) {
        count++;
        var time = new Date().toLocaleTimeString();
        logs.push(count + '. [' + time + '] ' + msg);
        if (logs.length > 100) logs.shift();

        if (debugDiv) {
            debugDiv.innerHTML = logs.join('<br>');
            debugDiv.scrollTop = debugDiv.scrollHeight;
        }
    };

    window.onerror = function(msg, url, line) {
        log('ERROR: ' + msg + ' at line ' + line, true);
    };

    log('Loading...');
})();'''

new_logger = '''// Ultra-simple logger with maximum compatibility
(function() {
    var logs = [];
    var count = 0;
    
    window.log = function(msg) {
        count++;
        var time = new Date().toLocaleTimeString();
        var logLine = count + '. [' + time + '] ' + String(msg);
        logs.push(logLine);
        if (logs.length > 50) logs.shift();
        
        // Update debug div
        try {
            var debugDiv = document.getElementById('debug-log');
            if (debugDiv) {
                debugDiv.innerHTML = logs.join('<br>\\n');
                debugDiv.scrollTop = 99999;
            }
        } catch(e) {
            // Ignore errors in logger itself
        }
    };

    window.onerror = function(msg, url, line) {
        log('ERROR: ' + msg + ' at line ' + line);
        return true;
    };

    window.addEventListener('unhandledrejection', function(e) {
        log('PROMISE ERROR: ' + (e.reason || 'unknown'));
    });

    log('1. Logger initialized');
    log('2. Testing basic features...');
    log('3. typeof Promise: ' + typeof Promise);
    log('4. typeof fetch: ' + typeof fetch);
    log('5. typeof TextEncoder: ' + typeof TextEncoder);
    
    // Test async/await support
    try {
        eval('(async function(){})()');
        log('6. async/await: SUPPORTED');
    } catch(e) {
        log('6. async/await: ERROR - ' + e.message);
    }
    
    log('7. Starting app load...');
})();'''

html = html.replace(old_logger, new_logger)

# Save
with open('index.html', 'w') as f:
    f.write(html)

print("✓ Added Kindle diagnostics to index.html")
print("Deploy this and check what appears on Kindle")
