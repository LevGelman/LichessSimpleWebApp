// Polyfills for Kindle Browser Compatibility
// These provide fallbacks for missing modern browser APIs

(function() {
    'use strict';

    // ============================================
    // TextEncoder / TextDecoder Polyfills
    // ============================================

    if (typeof TextEncoder === 'undefined') {
        window.TextEncoder = function TextEncoder() {};
        TextEncoder.prototype.encode = function encode(str) {
            var utf8 = [];
            for (var i = 0; i < str.length; i++) {
                var charcode = str.charCodeAt(i);
                if (charcode < 0x80) {
                    utf8.push(charcode);
                } else if (charcode < 0x800) {
                    utf8.push(0xc0 | (charcode >> 6),
                              0x80 | (charcode & 0x3f));
                } else if (charcode < 0xd800 || charcode >= 0xe000) {
                    utf8.push(0xe0 | (charcode >> 12),
                              0x80 | ((charcode >> 6) & 0x3f),
                              0x80 | (charcode & 0x3f));
                } else {
                    i++;
                    charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
                    utf8.push(0xf0 | (charcode >> 18),
                              0x80 | ((charcode >> 12) & 0x3f),
                              0x80 | ((charcode >> 6) & 0x3f),
                              0x80 | (charcode & 0x3f));
                }
            }
            return new Uint8Array(utf8);
        };
    }

    if (typeof TextDecoder === 'undefined') {
        window.TextDecoder = function TextDecoder() {};
        TextDecoder.prototype.decode = function decode(bytes) {
            var str = '';
            var i = 0;
            while (i < bytes.length) {
                var byte1 = bytes[i];
                if (byte1 < 0x80) {
                    str += String.fromCharCode(byte1);
                    i++;
                } else if (byte1 >= 0xc0 && byte1 < 0xe0) {
                    var byte2 = bytes[i + 1];
                    str += String.fromCharCode(((byte1 & 0x1f) << 6) | (byte2 & 0x3f));
                    i += 2;
                } else if (byte1 >= 0xe0 && byte1 < 0xf0) {
                    var byte2 = bytes[i + 1];
                    var byte3 = bytes[i + 2];
                    str += String.fromCharCode(((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f));
                    i += 3;
                } else {
                    var byte2 = bytes[i + 1];
                    var byte3 = bytes[i + 2];
                    var byte4 = bytes[i + 3];
                    var codepoint = ((byte1 & 0x07) << 18) | ((byte2 & 0x3f) << 12) | ((byte3 & 0x3f) << 6) | (byte4 & 0x3f);
                    codepoint -= 0x10000;
                    str += String.fromCharCode((codepoint >> 10) + 0xd800, (codepoint & 0x3ff) + 0xdc00);
                    i += 4;
                }
            }
            return str;
        };
    }

    // ============================================
    // Crypto Polyfill for SHA-256
    // ============================================

    // Check if crypto.subtle.digest exists
    if (!window.crypto || !window.crypto.subtle || !window.crypto.subtle.digest) {
        console.warn('crypto.subtle.digest not available, using fallback SHA-256');

        // Simplified SHA-256 implementation
        // Based on https://github.com/emn178/js-sha256
        function sha256Hash(bytes) {
            var h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
            var h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
            var w = [];
            var a, b, c, d, e, f, g, h, i, j, t1, t2;
            var k = [
                0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
                0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
                0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
                0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
                0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
                0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
                0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
                0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
            ];

            // Padding
            var msgLen = bytes.length;
            var bitLen = msgLen * 8;
            var paddedLen = ((msgLen + 8) >> 6 << 4) + 16;
            var blocks = new Uint32Array(paddedLen);

            // Copy bytes to blocks
            for (i = 0; i < msgLen; i++) {
                blocks[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
            }

            // Append 1 bit and length
            blocks[msgLen >> 2] |= 0x80 << (24 - (msgLen % 4) * 8);
            blocks[paddedLen - 1] = bitLen;
            blocks[paddedLen - 2] = (bitLen / 0x100000000) | 0;

            // Process blocks
            for (i = 0; i < paddedLen; i += 16) {
                a = h0; b = h1; c = h2; d = h3;
                e = h4; f = h5; g = h6; h = h7;

                for (j = 0; j < 64; j++) {
                    if (j < 16) {
                        w[j] = blocks[i + j];
                    } else {
                        var s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
                        var s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
                        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
                    }

                    var S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
                    var ch = (e & f) ^ (~e & g);
                    t1 = (h + S1 + ch + k[j] + w[j]) | 0;
                    var S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
                    var maj = (a & b) ^ (a & c) ^ (b & c);
                    t2 = (S0 + maj) | 0;

                    h = g; g = f; f = e;
                    e = (d + t1) | 0;
                    d = c; c = b; b = a;
                    a = (t1 + t2) | 0;
                }

                h0 = (h0 + a) | 0; h1 = (h1 + b) | 0;
                h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
                h4 = (h4 + e) | 0; h5 = (h5 + f) | 0;
                h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
            }

            // Return hash as ArrayBuffer
            var hash = new Uint8Array(32);
            hash[0] = (h0 >>> 24) & 0xff; hash[1] = (h0 >>> 16) & 0xff;
            hash[2] = (h0 >>> 8) & 0xff;  hash[3] = h0 & 0xff;
            hash[4] = (h1 >>> 24) & 0xff; hash[5] = (h1 >>> 16) & 0xff;
            hash[6] = (h1 >>> 8) & 0xff;  hash[7] = h1 & 0xff;
            hash[8] = (h2 >>> 24) & 0xff; hash[9] = (h2 >>> 16) & 0xff;
            hash[10] = (h2 >>> 8) & 0xff; hash[11] = h2 & 0xff;
            hash[12] = (h3 >>> 24) & 0xff; hash[13] = (h3 >>> 16) & 0xff;
            hash[14] = (h3 >>> 8) & 0xff;  hash[15] = h3 & 0xff;
            hash[16] = (h4 >>> 24) & 0xff; hash[17] = (h4 >>> 16) & 0xff;
            hash[18] = (h4 >>> 8) & 0xff;  hash[19] = h4 & 0xff;
            hash[20] = (h5 >>> 24) & 0xff; hash[21] = (h5 >>> 16) & 0xff;
            hash[22] = (h5 >>> 8) & 0xff;  hash[23] = h5 & 0xff;
            hash[24] = (h6 >>> 24) & 0xff; hash[25] = (h6 >>> 16) & 0xff;
            hash[26] = (h6 >>> 8) & 0xff;  hash[27] = h6 & 0xff;
            hash[28] = (h7 >>> 24) & 0xff; hash[29] = (h7 >>> 16) & 0xff;
            hash[30] = (h7 >>> 8) & 0xff;  hash[31] = h7 & 0xff;

            return hash.buffer;
        }

        function rightRotate(n, b) {
            return (n >>> b) | (n << (32 - b));
        }

        // Create polyfill
        if (!window.crypto) {
            window.crypto = {};
        }
        if (!window.crypto.subtle) {
            window.crypto.subtle = {};
        }

        window.crypto.subtle.digest = function(algorithm, data) {
            return new Promise(function(resolve, reject) {
                try {
                    if (algorithm === 'SHA-256') {
                        var bytes = new Uint8Array(data);
                        var hash = sha256Hash(bytes);
                        resolve(hash);
                    } else {
                        reject(new Error('Unsupported algorithm: ' + algorithm));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        };
    }

    // ============================================
    // URLSearchParams Polyfill
    // ============================================

    if (typeof URLSearchParams === 'undefined' || !URLSearchParams.prototype.toString) {
        window.URLSearchParams = function(init) {
            this.params = {};

            if (typeof init === 'string') {
                var pairs = init.replace(/^\?/, '').split('&');
                for (var i = 0; i < pairs.length; i++) {
                    var pair = pairs[i].split('=');
                    if (pair[0]) {
                        this.params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
                    }
                }
            } else if (typeof init === 'object') {
                for (var key in init) {
                    if (init.hasOwnProperty(key)) {
                        this.params[key] = init[key];
                    }
                }
            }
        };

        URLSearchParams.prototype.get = function(name) {
            return this.params[name] || null;
        };

        URLSearchParams.prototype.set = function(name, value) {
            this.params[name] = String(value);
        };

        URLSearchParams.prototype.toString = function() {
            var parts = [];
            for (var key in this.params) {
                if (this.params.hasOwnProperty(key)) {
                    parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(this.params[key]));
                }
            }
            return parts.join('&');
        };
    }

    // ============================================
    // Promise.prototype.finally Polyfill
    // ============================================

    if (typeof Promise !== 'undefined' && !Promise.prototype.finally) {
        Promise.prototype.finally = function(callback) {
            var P = this.constructor;
            return this.then(
                function(value) {
                    return P.resolve(callback()).then(function() { return value; });
                },
                function(reason) {
                    return P.resolve(callback()).then(function() { throw reason; });
                }
            );
        };
    }

    // Mark that polyfills loaded
    window.POLYFILLS_LOADED = true;

    // Try to log (console might not be overridden yet)
    if (window.console && window.console.log) {
        window.console.log('✓ Polyfills loaded successfully');
    }
})();
