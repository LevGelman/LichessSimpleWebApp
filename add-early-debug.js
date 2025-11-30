// Early debug logger - add this at the VERY START of the inline script
// This writes directly to DOM, no console override

(function() {
    var debugDiv = null;
    var debugBuffer = [];

    // Find or wait for debug div
    function getDebugDiv() {
        if (!debugDiv) {
            debugDiv = document.getElementById('debug-log');
        }
        return debugDiv;
    }

    // Log function
    window.earlyLog = function(msg) {
        var time = new Date().toLocaleTimeString();
        var line = '[' + time + '] ' + msg;

        debugBuffer.push(line);

        var div = getDebugDiv();
        if (div) {
            // Flush buffer
            div.innerHTML = debugBuffer.map(function(l) {
                return '<div>' + l + '</div>';
            }).join('');
        }
    };

    earlyLog('🔷 Early debug logger loaded');
})();
