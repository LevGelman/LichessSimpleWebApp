// Lichess Kindle Client - Main Application
// No dependencies, vanilla JS

// ============================================
// State
// ============================================

const state = {
    token: null,
    user: null,
    currentGame: null,
    board: null,
    selectedSquare: null,
    legalMoves: [],
    orientation: 'white',
    pendingPromotion: null,
    eventSource: null,
    seekEventSource: null,
    seekReader: null,
    eventStreamReader: null,
    clockInterval: null,
    lastClockUpdate: null,
    whiteTime: null,
    blackTime: null,
    isWhiteTurn: true
};

// ============================================
// Utility Functions
// ============================================

function $(id) {
    return document.getElementById(id);
}

function show(id) {
    $(id).classList.remove('hidden');
}

function hide(id) {
    $(id).classList.add('hidden');
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    $(screenId).classList.remove('hidden');
}

function showError(message) {
    $('error-message').textContent = message;
    show('error-banner');
    
    // Auto-hide after 5 seconds
    setTimeout(function() {
        hide('error-banner');
    }, 5000);
}

function dismissError() {
    hide('error-banner');
}

// Generate random string for OAuth PKCE
function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const values = new Uint8Array(length);
    window.crypto.getRandomValues(values);
    for (let i = 0; i < length; i++) {
        result += chars[values[i] % chars.length];
    }
    return result;
}

// SHA256 hash for PKCE
async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const hash = await window.crypto.subtle.digest('SHA-256', data);
    return hash;
}

// Base64 URL encode
function base64UrlEncode(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// Format time for clock display
function formatTime(seconds) {
    if (seconds === undefined || seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
}

// Fetch with timeout for Kindle compatibility
function fetchWithTimeout(url, options, timeout) {
    timeout = timeout || 30000; // 30 second default

    return new Promise(function(resolve, reject) {
        var timedOut = false;
        var timer = setTimeout(function() {
            timedOut = true;
            reject(new Error('Request timeout'));
        }, timeout);

        fetch(url, options)
            .then(function(response) {
                clearTimeout(timer);
                if (!timedOut) {
                    resolve(response);
                }
            })
            .catch(function(error) {
                clearTimeout(timer);
                if (!timedOut) {
                    reject(error);
                }
            });
    });
}

// ============================================
// OAuth Authentication
// ============================================

async function startLogin() {
    try {
        console.log('Starting login...');
        const codeVerifier = generateRandomString(64);
        localStorage.setItem('pkce_verifier', codeVerifier);

        console.log('Hashing code verifier...');
        const hashed = await sha256(codeVerifier);
        const codeChallenge = base64UrlEncode(hashed);
        console.log('Hash complete');

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: CONFIG.LICHESS_CLIENT_ID,
            redirect_uri: CONFIG.REDIRECT_URI,
            scope: 'board:play',
            code_challenge_method: 'S256',
            code_challenge: codeChallenge
        });

        window.location.href = CONFIG.LICHESS_HOST + '/oauth?' + params.toString();
    } catch (err) {
        console.error('Login failed:', err);
        showError('Login failed: ' + err.message);
        showScreen('screen-login');
    }
}

async function handleOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    
    if (!code) return false;
    
    const codeVerifier = localStorage.getItem('pkce_verifier');
    if (!codeVerifier) {
        console.error('No code verifier found');
        return false;
    }
    
    try {
        console.log('Exchanging OAuth code for token...');
        const response = await fetchWithTimeout(CONFIG.LICHESS_HOST + '/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                code_verifier: codeVerifier,
                redirect_uri: CONFIG.REDIRECT_URI,
                client_id: CONFIG.LICHESS_CLIENT_ID
            }).toString()
        }, 30000);

        if (!response.ok) {
            console.error('Token exchange failed with status:', response.status);
            throw new Error('Token exchange failed');
        }

        const data = await response.json();
        state.token = data.access_token;
        localStorage.setItem('lichess_token', state.token);
        localStorage.removeItem('pkce_verifier');

        console.log('OAuth success');
        // Clean URL
        window.history.replaceState({}, document.title, '/');

        return true;
    } catch (err) {
        console.error('OAuth error:', err);
        showError('OAuth failed: ' + err.message);
        return false;
    }
}

async function checkAuth() {
    state.token = localStorage.getItem('lichess_token');
    if (!state.token) return false;

    try {
        console.log('Checking authentication...');
        const response = await fetchWithTimeout(CONFIG.LICHESS_HOST + '/api/account', {
            headers: { 'Authorization': 'Bearer ' + state.token }
        }, 20000);

        if (!response.ok) {
            console.log('Auth check failed, clearing token');
            localStorage.removeItem('lichess_token');
            state.token = null;
            return false;
        }

        state.user = await response.json();
        console.log('Authenticated as:', state.user.username);
        return true;
    } catch (err) {
        console.error('Auth check failed:', err);
        showError('Connection failed: ' + err.message);
        localStorage.removeItem('lichess_token');
        state.token = null;
        return false;
    }
}

function logout() {
    localStorage.removeItem('lichess_token');
    state.token = null;
    state.user = null;
    if (state.eventSource) state.eventSource.close();
    if (state.seekEventSource) state.seekEventSource.close();
    stopEventStream();
    showScreen('screen-login');
}

// ============================================
// Lobby & Game Seeking
// ============================================

function showLobby() {
    $('username').textContent = state.user.username;
    renderTimeControls();
    showScreen('screen-lobby');
    checkOngoingGames();
}

function renderTimeControls() {
    const container = $('time-controls');
    container.innerHTML = '';
    
    CONFIG.TIME_CONTROLS.forEach(tc => {
        const btn = document.createElement('button');
        btn.className = 'btn time-btn';
        btn.textContent = tc.name;
        btn.onclick = () => seekGame(tc.time, tc.increment);
        container.appendChild(btn);
    });
}

async function checkOngoingGames() {
    try {
        const response = await fetchWithTimeout(CONFIG.LICHESS_HOST + '/api/account/playing', {
            headers: { 'Authorization': 'Bearer ' + state.token }
        }, 15000);

        if (!response.ok) return;

        const data = await response.json();
        const games = data.nowPlaying || [];

        if (games.length > 0) {
            show('ongoing-games');
            const list = $('games-list');
            list.innerHTML = '';

            games.forEach(game => {
                const div = document.createElement('div');
                div.className = 'game-item';
                div.innerHTML =
                    '<span>vs ' + game.opponent.username + '</span>' +
                    '<button class="btn btn-small">Resume</button>';
                div.querySelector('button').onclick = () => joinGame(game.gameId);
                list.appendChild(div);
            });
        } else {
            hide('ongoing-games');
        }
    } catch (err) {
        console.error('Failed to check ongoing games:', err);
    }
}

async function seekGame(minutes, increment) {
    show('seeking');
    
    // First, start listening to the event stream to catch game start
    startEventStream();
    
    try {
        // Create the seek - this will stream until cancelled or game found
        const response = await fetchWithTimeout(CONFIG.LICHESS_HOST + '/api/board/seek', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + state.token,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                time: minutes,
                increment: increment,
                rated: 'true',
                variant: 'standard',
                color: 'random'
            }).toString()
        }, 120000);
        
        if (!response.ok) {
            let errorMsg = 'Seek failed: ' + response.status;
            try {
                const errorBody = await response.text();
                console.error('Seek error body:', errorBody);
                errorMsg += ' - ' + errorBody;
            } catch (e) {}
            throw new Error(errorMsg);
        }
        
        // The seek stream stays open while waiting for an opponent
        // Game start notification comes via the event stream
        // Keep reading to keep the seek alive
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        state.seekReader = reader;
        
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                console.log('Seek stream ended');
                break;
            }
            
            const text = decoder.decode(value);
            console.log('Seek stream data:', text);
            
            // Sometimes the game ID comes directly in the seek response
            const lines = text.split('\n').filter(l => l.trim());
            for (const line of lines) {
                try {
                    const event = JSON.parse(line);
                    console.log('Seek event:', event);
                    if (event.id) {
                        hide('seeking');
                        joinGame(event.id);
                        return;
                    }
                } catch (e) {}
            }
        }
        
        // Stream ended without finding game
        hide('seeking');
        showError('No opponent found. Try again.');
        
    } catch (err) {
        console.error('Seek error:', err);
        hide('seeking');
        if (err.name !== 'AbortError') {
            showError('Failed to find game. Please try again.');
        }
    }
}

// Event stream to receive game start notifications
function startEventStream() {
    if (state.eventStreamReader) {
        return; // Already listening
    }

    console.log('Starting event stream...');

    fetch(CONFIG.LICHESS_HOST + '/api/stream/event', {
        headers: { 'Authorization': 'Bearer ' + state.token }
    }).then(function(response) {
        if (!response.ok) {
            console.error('Event stream failed:', response.status);
            return;
        }

        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        state.eventStreamReader = reader;

        // Iterative reading to avoid stack overflow on Kindle
        function readChunk() {
            reader.read().then(function(result) {
                if (result.done) {
                    console.log('Event stream ended');
                    state.eventStreamReader = null;
                    return;
                }

                try {
                    var text = decoder.decode(result.value, { stream: true });
                    var lines = text.split('\n');

                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i].trim();
                        if (line) {
                            try {
                                var event = JSON.parse(line);
                                console.log('Event:', event);
                                handleIncomingEvent(event);
                            } catch (e) {
                                console.log('Failed to parse event line:', e);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Failed to decode stream:', e);
                }

                // Continue reading (async, no recursion)
                setTimeout(readChunk, 0);
            }).catch(function(err) {
                console.error('Event stream error:', err);
                state.eventStreamReader = null;
            });
        }

        readChunk();
    }).catch(function(err) {
        console.error('Failed to start event stream:', err);
    });
}

function handleIncomingEvent(event) {
    if (event.type === 'gameStart') {
        console.log('Game started!', event.game);
        hide('seeking');
        
        // Cancel the seek stream
        if (state.seekReader) {
            state.seekReader.cancel();
            state.seekReader = null;
        }
        
        joinGame(event.game.gameId || event.game.id);
    } else if (event.type === 'gameFinish') {
        console.log('Game finished', event.game);
        checkOngoingGames();
    } else if (event.type === 'challenge') {
        console.log('Challenge received', event.challenge);
        // Could show challenge notification here
    }
}

function stopEventStream() {
    if (state.eventStreamReader) {
        state.eventStreamReader.cancel();
        state.eventStreamReader = null;
    }
}

function cancelSeek() {
    // Cancel the seek stream
    if (state.seekReader) {
        state.seekReader.cancel();
        state.seekReader = null;
    }
    if (state.seekEventSource) {
        state.seekEventSource.close();
        state.seekEventSource = null;
    }
    hide('seeking');
}

// ============================================
// Game Logic
// ============================================

async function joinGame(gameId) {
    state.currentGame = { id: gameId };
    state.board = null;
    state.selectedSquare = null;
    state.legalMoves = [];
    
    showScreen('screen-game');
    hide('game-result');
    show('game-controls');
    $('game-status').textContent = 'Connecting...';
    
    // Stream game events
    streamGame(gameId);
}

function streamGame(gameId) {
    if (state.eventSource) {
        state.eventSource.close();
    }

    console.log('Streaming game:', gameId);

    // Use fetch with streaming for better Kindle compatibility
    fetch(CONFIG.LICHESS_HOST + '/api/board/game/stream/' + gameId, {
        headers: { 'Authorization': 'Bearer ' + state.token }
    }).then(function(response) {
        if (!response.ok) {
            console.error('Game stream failed:', response.status);
            $('game-status').textContent = 'Connection failed';
            return;
        }

        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';

        // Iterative reading to avoid stack overflow on Kindle
        function readChunk() {
            reader.read().then(function(result) {
                if (result.done) {
                    console.log('Game stream ended');
                    return;
                }

                try {
                    buffer += decoder.decode(result.value, { stream: true });
                    var lines = buffer.split('\n');

                    // Keep last incomplete line in buffer
                    buffer = lines.pop() || '';

                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i].trim();
                        if (line) {
                            try {
                                var event = JSON.parse(line);
                                handleGameEvent(event);
                            } catch (e) {
                                console.log('Failed to parse game event:', e);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Failed to decode game stream:', e);
                }

                // Continue reading (async, no recursion)
                setTimeout(readChunk, 0);
            }).catch(function(err) {
                console.error('Game stream error:', err);
                $('game-status').textContent = 'Connection lost';
            });
        }

        readChunk();
    }).catch(function(err) {
        console.error('Failed to stream game:', err);
        $('game-status').textContent = 'Connection failed';
        showError('Failed to connect to game');
    });
}

function handleGameEvent(event) {
    if (event.type === 'gameFull') {
        // Initial game state
        state.currentGame = {
            ...state.currentGame,
            white: event.white,
            black: event.black,
            initialFen: event.initialFen || 'startpos'
        };
        
        // Determine orientation
        state.orientation = (event.white.id === state.user.id.toLowerCase()) ? 'white' : 'black';
        
        // Set player names
        if (state.orientation === 'white') {
            $('player-name').textContent = event.white.name || event.white.id;
            $('opponent-name').textContent = event.black.name || event.black.id;
        } else {
            $('player-name').textContent = event.black.name || event.black.id;
            $('opponent-name').textContent = event.white.name || event.white.id;
        }
        
        handleGameState(event.state);
        
    } else if (event.type === 'gameState') {
        handleGameState(event);
        
    } else if (event.type === 'chatLine') {
        // Ignore chat
    }
}

function handleGameState(gameState) {
    // Parse moves and build position
    const moves = gameState.moves ? gameState.moves.split(' ').filter(m => m) : [];
    state.board = buildPosition(moves);
    state.currentGame.moves = moves;
    state.currentGame.status = gameState.status;
    state.currentGame.winner = gameState.winner;
    
    // Calculate whose turn
    state.isWhiteTurn = moves.length % 2 === 0;
    const isMyTurn = (state.orientation === 'white') === state.isWhiteTurn;
    
    // Update clocks
    updateClocks(gameState.wtime, gameState.btime);
    
    // Update status
    if (gameState.status === 'started' || gameState.status === 'created') {
        $('game-status').textContent = isMyTurn ? 'Your turn' : "Opponent's turn";
    } else {
        stopClockTimer();
        showGameResult(gameState);
    }
    
    // Clear selection
    state.selectedSquare = null;
    state.legalMoves = [];
    
    renderBoard();
}

function updateClocks(wtime, btime) {
    state.whiteTime = Math.floor((wtime || 0) / 1000);
    state.blackTime = Math.floor((btime || 0) / 1000);
    state.lastClockUpdate = Date.now();
    
    renderClocks();
    startClockTimer();
}

function renderClocks() {
    let playerTime, opponentTime;
    if (state.orientation === 'white') {
        playerTime = state.whiteTime;
        opponentTime = state.blackTime;
    } else {
        playerTime = state.blackTime;
        opponentTime = state.whiteTime;
    }
    
    const playerClock = $('player-clock');
    const opponentClock = $('opponent-clock');
    
    playerClock.textContent = formatTime(Math.max(0, playerTime));
    opponentClock.textContent = formatTime(Math.max(0, opponentTime));
    
    const threshold = CONFIG.SETTINGS?.lowTimeThreshold || 30;
    playerClock.classList.toggle('low-time', playerTime < threshold);
    opponentClock.classList.toggle('low-time', opponentTime < threshold);
}

function startClockTimer() {
    // Clear existing timer
    if (state.clockInterval) {
        clearInterval(state.clockInterval);
    }
    
    // Only run timer during active game
    if (!state.currentGame || state.currentGame.status !== 'started') {
        return;
    }
    
    // Update clock every second
    state.clockInterval = setInterval(function() {
        if (!state.lastClockUpdate) return;
        
        const elapsed = Math.floor((Date.now() - state.lastClockUpdate) / 1000);
        
        if (state.isWhiteTurn) {
            state.whiteTime = Math.max(0, state.whiteTime - elapsed);
        } else {
            state.blackTime = Math.max(0, state.blackTime - elapsed);
        }
        
        state.lastClockUpdate = Date.now();
        renderClocks();
    }, 1000);
}

function stopClockTimer() {
    if (state.clockInterval) {
        clearInterval(state.clockInterval);
        state.clockInterval = null;
    }
}

function showGameResult(gameState) {
    hide('game-controls');
    show('game-result');
    
    let resultText = '';
    const status = gameState.status;
    const winner = gameState.winner;
    
    if (status === 'draw' || status === 'stalemate') {
        resultText = 'Draw';
    } else if (status === 'mate') {
        resultText = winner === state.orientation ? 'You won by checkmate!' : 'You lost by checkmate';
    } else if (status === 'resign') {
        resultText = winner === state.orientation ? 'Opponent resigned - You win!' : 'You resigned';
    } else if (status === 'timeout') {
        resultText = winner === state.orientation ? 'Opponent ran out of time - You win!' : 'You ran out of time';
    } else if (status === 'outoftime') {
        resultText = winner === state.orientation ? 'You win on time!' : 'You lost on time';
    } else {
        resultText = 'Game over: ' + status;
    }
    
    $('result-text').textContent = resultText;
    $('game-status').textContent = 'Game Over';
}

// ============================================
// Board Position & Move Generation
// ============================================

function buildPosition(moves) {
    // Start from initial position
    const board = [
        ['r','n','b','q','k','b','n','r'],
        ['p','p','p','p','p','p','p','p'],
        ['','','','','','','',''],
        ['','','','','','','',''],
        ['','','','','','','',''],
        ['','','','','','','',''],
        ['P','P','P','P','P','P','P','P'],
        ['R','N','B','Q','K','B','N','R']
    ];
    
    // Apply each move
    for (const move of moves) {
        applyMove(board, move);
    }
    
    return board;
}

function applyMove(board, uci) {
    const fromFile = uci.charCodeAt(0) - 97;
    const fromRank = 8 - parseInt(uci[1]);
    const toFile = uci.charCodeAt(2) - 97;
    const toRank = 8 - parseInt(uci[3]);
    const promotion = uci[4];
    
    const piece = board[fromRank][fromFile];
    
    // Handle castling
    if (piece.toLowerCase() === 'k' && Math.abs(fromFile - toFile) === 2) {
        // Move king
        board[toRank][toFile] = piece;
        board[fromRank][fromFile] = '';
        
        // Move rook
        if (toFile > fromFile) {
            // Kingside
            board[toRank][5] = board[toRank][7];
            board[toRank][7] = '';
        } else {
            // Queenside
            board[toRank][3] = board[toRank][0];
            board[toRank][0] = '';
        }
        return;
    }
    
    // Handle en passant
    if (piece.toLowerCase() === 'p' && fromFile !== toFile && !board[toRank][toFile]) {
        board[fromRank][toFile] = '';
    }
    
    // Regular move
    board[toRank][toFile] = piece;
    board[fromRank][fromFile] = '';
    
    // Handle promotion
    if (promotion) {
        const isWhite = piece === 'P';
        board[toRank][toFile] = isWhite ? promotion.toUpperCase() : promotion.toLowerCase();
    }
}

function getLegalMoves(square) {
    // Simplified move generation - server validates anyway
    const file = square.charCodeAt(0) - 97;
    const rank = 8 - parseInt(square[1]);
    const piece = state.board[rank][file];
    
    if (!piece) return [];
    
    const isWhite = piece === piece.toUpperCase();
    const isMyPiece = (state.orientation === 'white') === isWhite;
    
    if (!isMyPiece) return [];
    
    const moves = [];
    const type = piece.toLowerCase();
    
    // Generate pseudo-legal moves (server will validate)
    if (type === 'p') {
        const dir = isWhite ? -1 : 1;
        const startRank = isWhite ? 6 : 1;
        
        // Forward
        if (!state.board[rank + dir]?.[file]) {
            moves.push([file, rank + dir]);
            // Double push
            if (rank === startRank && !state.board[rank + dir * 2]?.[file]) {
                moves.push([file, rank + dir * 2]);
            }
        }
        
        // Captures
        [-1, 1].forEach(df => {
            const nf = file + df;
            const nr = rank + dir;
            if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
                const target = state.board[nr][nf];
                if (target && (target === target.toUpperCase()) !== isWhite) {
                    moves.push([nf, nr]);
                }
                // En passant (simplified check)
                if (!target && (rank === 3 || rank === 4)) {
                    moves.push([nf, nr]);
                }
            }
        });
    } else if (type === 'n') {
        [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([df, dr]) => {
            const nf = file + df, nr = rank + dr;
            if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
                const target = state.board[nr][nf];
                if (!target || (target === target.toUpperCase()) !== isWhite) {
                    moves.push([nf, nr]);
                }
            }
        });
    } else if (type === 'k') {
        for (let dr = -1; dr <= 1; dr++) {
            for (let df = -1; df <= 1; df++) {
                if (dr === 0 && df === 0) continue;
                const nf = file + df, nr = rank + dr;
                if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
                    const target = state.board[nr][nf];
                    if (!target || (target === target.toUpperCase()) !== isWhite) {
                        moves.push([nf, nr]);
                    }
                }
            }
        }
        // Castling (simplified)
        if ((isWhite && rank === 7 && file === 4) || (!isWhite && rank === 0 && file === 4)) {
            moves.push([6, rank]); // Kingside
            moves.push([2, rank]); // Queenside
        }
    } else {
        // Sliding pieces (B, R, Q)
        const directions = [];
        if (type === 'b' || type === 'q') directions.push([-1,-1],[-1,1],[1,-1],[1,1]);
        if (type === 'r' || type === 'q') directions.push([-1,0],[1,0],[0,-1],[0,1]);
        
        directions.forEach(([df, dr]) => {
            for (let i = 1; i < 8; i++) {
                const nf = file + df * i, nr = rank + dr * i;
                if (nf < 0 || nf >= 8 || nr < 0 || nr >= 8) break;
                const target = state.board[nr][nf];
                if (!target) {
                    moves.push([nf, nr]);
                } else {
                    if ((target === target.toUpperCase()) !== isWhite) {
                        moves.push([nf, nr]);
                    }
                    break;
                }
            }
        });
    }
    
    return moves.map(([f, r]) => String.fromCharCode(97 + f) + (8 - r));
}

// ============================================
// Board Rendering
// ============================================

function renderBoard() {
    const container = $('board');
    container.innerHTML = '';
    
    const lastMove = state.currentGame?.moves?.slice(-1)[0];
    let lastFrom = null, lastTo = null;
    if (lastMove) {
        lastFrom = lastMove.slice(0, 2);
        lastTo = lastMove.slice(2, 4);
    }
    
    // Simple check detection - server handles check detection
    // Could highlight king in check here in the future
    
    for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
            const rank = state.orientation === 'white' ? r : 7 - r;
            const file = state.orientation === 'white' ? f : 7 - f;
            const square = String.fromCharCode(97 + file) + (8 - rank);
            const piece = state.board[rank][file];
            
            const div = document.createElement('div');
            div.className = 'square ' + ((rank + file) % 2 === 0 ? 'light' : 'dark');
            div.dataset.square = square;
            
            // Highlights
            if (square === lastFrom || square === lastTo) {
                div.classList.add('last-move');
            }
            if (square === state.selectedSquare) {
                div.classList.add('selected');
            }
            if (state.legalMoves.includes(square)) {
                div.classList.add(state.board[rank][file] ? 'legal-capture' : 'legal-move');
            }
            
            // Piece
            if (piece) {
                const span = document.createElement('span');
                span.className = 'piece ' + (piece === piece.toUpperCase() ? 'white' : 'black');
                span.textContent = getPieceSymbol(piece);
                div.appendChild(span);
            }
            
            div.onclick = () => handleSquareClick(square);
            container.appendChild(div);
        }
    }
}

function getPieceSymbol(piece) {
    const symbols = {
        'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
        'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
    };
    return symbols[piece] || '';
}

// ============================================
// Move Handling
// ============================================

function handleSquareClick(square) {
    if (!state.currentGame || state.currentGame.status !== 'started') return;
    
    const file = square.charCodeAt(0) - 97;
    const rank = 8 - parseInt(square[1]);
    const piece = state.board[rank][file];
    
    // Check if it's my turn
    const isWhiteTurn = (state.currentGame.moves?.length || 0) % 2 === 0;
    const isMyTurn = (state.orientation === 'white') === isWhiteTurn;
    
    if (!isMyTurn) return;
    
    if (state.selectedSquare) {
        // Second click - try to make move
        if (state.legalMoves.includes(square)) {
            makeMove(state.selectedSquare, square);
        } else if (piece) {
            // Select different piece
            const isWhite = piece === piece.toUpperCase();
            if ((state.orientation === 'white') === isWhite) {
                state.selectedSquare = square;
                state.legalMoves = getLegalMoves(square);
            } else {
                state.selectedSquare = null;
                state.legalMoves = [];
            }
        } else {
            state.selectedSquare = null;
            state.legalMoves = [];
        }
    } else {
        // First click - select piece
        if (piece) {
            const isWhite = piece === piece.toUpperCase();
            if ((state.orientation === 'white') === isWhite) {
                state.selectedSquare = square;
                state.legalMoves = getLegalMoves(square);
            }
        }
    }
    
    renderBoard();
}

function makeMove(from, to) {
    const fromFile = from.charCodeAt(0) - 97;
    const fromRank = 8 - parseInt(from[1]);
    const piece = state.board[fromRank][fromFile];
    
    // Check for promotion
    const toRank = 8 - parseInt(to[1]);
    const isPawn = piece.toLowerCase() === 'p';
    const isPromotion = isPawn && (toRank === 0 || toRank === 7);
    
    if (isPromotion) {
        state.pendingPromotion = { from, to };
        show('promotion-modal');
        return;
    }
    
    sendMove(from + to);
}

function selectPromotion(piece) {
    if (!state.pendingPromotion) return;
    
    const { from, to } = state.pendingPromotion;
    hide('promotion-modal');
    sendMove(from + to + piece);
    state.pendingPromotion = null;
}

async function sendMove(uci) {
    state.selectedSquare = null;
    state.legalMoves = [];
    renderBoard();

    try {
        const response = await fetchWithTimeout(
            CONFIG.LICHESS_HOST + '/api/board/game/' + state.currentGame.id + '/move/' + uci,
            {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + state.token }
            },
            10000
        );

        if (!response.ok) {
            console.error('Move rejected');
            showError('Invalid move');
            // Move will be rejected, stream will update with correct state
        }
    } catch (err) {
        console.error('Failed to send move:', err);
        showError('Failed to send move');
    }
}

// ============================================
// Game Actions
// ============================================

async function resign() {
    if (!confirm('Are you sure you want to resign?')) return;

    try {
        await fetchWithTimeout(
            CONFIG.LICHESS_HOST + '/api/board/game/' + state.currentGame.id + '/resign',
            {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + state.token }
            },
            10000
        );
    } catch (err) {
        console.error('Failed to resign:', err);
        showError('Failed to resign');
    }
}

async function offerDraw() {
    try {
        await fetchWithTimeout(
            CONFIG.LICHESS_HOST + '/api/board/game/' + state.currentGame.id + '/draw/yes',
            {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + state.token }
            },
            10000
        );
        alert('Draw offer sent');
    } catch (err) {
        console.error('Failed to offer draw:', err);
        showError('Failed to offer draw');
    }
}

function backToLobby() {
    stopClockTimer();
    if (state.eventSource) {
        state.eventSource.close();
        state.eventSource = null;
    }
    showLobby();
}

function newGame() {
    stopClockTimer();
    if (state.eventSource) {
        state.eventSource.close();
        state.eventSource = null;
    }
    showLobby();
}

// ============================================
// Event Handlers Setup
// ============================================

function setupEventHandlers() {
    $('btn-login').onclick = startLogin;
    $('btn-logout').onclick = logout;
    $('btn-cancel-seek').onclick = cancelSeek;
    $('btn-back').onclick = backToLobby;
    $('btn-resign').onclick = resign;
    $('btn-draw').onclick = offerDraw;
    $('btn-new-game').onclick = newGame;
    $('btn-dismiss-error').onclick = dismissError;
    
    // Promotion buttons
    document.querySelectorAll('.promo-btn').forEach(btn => {
        btn.onclick = () => selectPromotion(btn.dataset.piece);
    });
}

// ============================================
// Initialization
// ============================================

function checkBrowserCompatibility() {
    console.log('=== Browser Compatibility Check ===');
    console.log('User Agent:', navigator.userAgent);
    console.log('TextEncoder:', typeof TextEncoder !== 'undefined' ? 'OK' : 'MISSING (polyfilled)');
    console.log('TextDecoder:', typeof TextDecoder !== 'undefined' ? 'OK' : 'MISSING (polyfilled)');
    console.log('crypto.subtle:', window.crypto && window.crypto.subtle ? 'OK' : 'MISSING (polyfilled)');
    console.log('URLSearchParams:', typeof URLSearchParams !== 'undefined' ? 'OK' : 'MISSING (polyfilled)');
    console.log('fetch:', typeof fetch !== 'undefined' ? 'OK' : 'MISSING');
    console.log('Promise:', typeof Promise !== 'undefined' ? 'OK' : 'MISSING');
    console.log('localStorage:', typeof localStorage !== 'undefined' ? 'OK' : 'MISSING');
    console.log('ReadableStream:', typeof ReadableStream !== 'undefined' ? 'OK' : 'MISSING');
    console.log('===================================');
}

async function init() {
    console.log('Initializing Lichess Kindle app...');
    checkBrowserCompatibility();

    setupEventHandlers();

    // Show loading screen first
    showScreen('screen-loading');

    // Check for OAuth callback
    if (window.location.search.includes('code=')) {
        console.log('OAuth callback detected');
        const success = await handleOAuthCallback();
        if (success) {
            const authed = await checkAuth();
            if (authed) {
                showLobby();
                return;
            }
        }
        showScreen('screen-login');
        showError('Login failed. Please try again.');
        return;
    }

    // Check existing auth
    const authed = await checkAuth();
    if (authed) {
        showLobby();
    } else {
        console.log('No existing auth, showing login screen');
        showScreen('screen-login');
    }
}

// Start app when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
