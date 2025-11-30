#!/usr/bin/env python3
# Strip down to absolute minimal debugging for Kindle

with open('index.html', 'r') as f:
    html = f.read()

# Find and replace the console override section (lines ~969-987)
# This complex debugLog is causing issues
old_console_override = '''// Override console methods to show on screen
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = function() {
    const message = Array.prototype.slice.call(arguments).join(' ');
    debugLog(message, false);
};

console.error = function() {
    const message = Array.prototype.slice.call(arguments).join(' ');
    debugLog(message, true);
};

console.warn = function() {
    const message = 'WARN: ' + Array.prototype.slice.call(arguments).join(' ');
    debugLog(message, false);
};'''

new_console_override = '''// Override console to use simple log
console.log = function() {
    var message = Array.prototype.slice.call(arguments).join(' ');
    log(message);
};

console.error = function() {
    var message = 'ERROR: ' + Array.prototype.slice.call(arguments).join(' ');
    log(message);
};

console.warn = function() {
    var message = 'WARN: ' + Array.prototype.slice.call(arguments).join(' ');
    log(message);
};'''

html = html.replace(old_console_override, new_console_override)

# Remove the complex debugLog functions (lines ~924-967)
# Find the debugLog section
old_debug_section = '''// ============================================
// On-Screen Debug Logger for Kindle
// ============================================

const debugLines = [];
const MAX_DEBUG_LINES = 50;

function debugLog(message, isError) {
    // Add to array
    const timestamp = new Date().toLocaleTimeString();
    debugLines.push({
        time: timestamp,
        msg: String(message),
        isError: isError
    });

    // Keep only last N lines
    if (debugLines.length > MAX_DEBUG_LINES) {
        debugLines.shift();
    }

    // Update display
    updateDebugDisplay();

    // Also log to console (if available)
    if (isError) {
        log(message);
    } else {
        log(message);
    }
}

function updateDebugDisplay() {
    const debugEl = document.getElementById('debug-log');
    if (!debugEl) return;

    let html = '';
    for (let i = 0; i < debugLines.length; i++) {
        const line = debugLines[i];
        const className = line.isError ? 'debug-error' : 'debug-ok';
        html += '<div class="debug-line ' + className + '">' +
                line.time + ' ' + line.msg + '</div>';
    }
    debugEl.innerHTML = html;

    // Auto-scroll to bottom
    debugEl.scrollTop = debugEl.scrollHeight;
}'''

new_debug_section = '''// Debug logging handled by window.log() function above'''

html = html.replace(old_debug_section, new_debug_section)

# Save
with open('index.html', 'w') as f:
    f.write(html)

print("✓ Simplified debug logging for Kindle")
print("✓ Removed complex debugLog system")
print("✓ All logging now goes through simple window.log()")
print("\nDeploy and check Kindle - you should see numbered log lines")
