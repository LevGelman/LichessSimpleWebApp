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

// ============================================
// OAuth Authentication
// ============================================

async function startLogin() {
    const codeVerifier = generateRandomString(64);
    localStorage.setItem('pkce_verifier', codeVerifier);
    
    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64UrlEncode(hashed);
    
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CONFIG.LICHESS_CLIENT_ID,
        redirect_uri: CONFIG.REDIRECT_URI,
        scope: 'board:play',
        code_challenge_method: 'S256',
        code_challenge: codeChallenge
    });
    
    window.location.href = CONFIG.LICHESS_HOST + '/oauth?' + params.toString();
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
        const response = await fetch(CONFIG.LICHESS_HOST + '/api/token', {
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
            })
        });
        
        if (!response.ok) throw new Error('Token exchange failed');
        
        const data = await response.json();
        state.token = data.access_token;
        localStorage.setItem('lichess_token', state.token);
        localStorage.removeItem('pkce_verifier');
        
        // Clean URL
        window.history.replaceState({}, document.title, '/');
        
        return true;
    } catch (err) {
        console.error('OAuth error:', err);
        return false;
    }
}

async function checkAuth() {
    state.token = localStorage.getItem('lichess_token');
    if (!state.token) return false;
    
    try {
        const response = await fetch(CONFIG.LICHESS_HOST + '/api/account', {
            headers: { 'Authorization': 'Bearer ' + state.token }
        });
        
        if (!response.ok) {
            localStorage.removeItem('lichess_token');
            state.token = null;
            return false;
        }
        
        state.user = await response.json();
        return true;
    } catch (err) {
        console.error('Auth check failed:', err);
        return false;
    }
}

function logout() {
    localStorage.removeItem('lichess_token');
    state.token = null;
    state.user = null;
    if (state.eventSource) state.eventSource.close();
    if (state.seekEventSource) state.seekEventSource.close();
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
        const response = await fetch(CONFIG.LICHESS_HOST + '/api/account/playing', {
            headers: { 'Authorization': 'Bearer ' + state.token }
        });
        
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
    
    // Close any existing seek
    if (state.seekEventSource) {
        state.seekEventSource.close();
    }
    
    try {
        const response = await fetch(CONFIG.LICHESS_HOST + '/api/board/seek', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + state.token,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                time: minutes,
                increment: increment,
                rated: 'true'
            })
        });
        
        if (!response.ok) {
            throw new Error('Seek failed: ' + response.status);
        }
        
        // Stream response for game start
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            const text = decoder.decode(value);
            const lines = text.split('\n').filter(l => l.trim());
            
            for (const line of lines) {
                try {
                    const event = JSON.parse(line);
                    if (event.id) {
                        // Game started
                        hide('seeking');
                        joinGame(event.id);
                        return;
                    }
                } catch (e) {}
            }
        }
        
        hide('seeking');
    } catch (err) {
        console.error('Seek error:', err);
        hide('seeking');
        showError('Failed to find game. Please try again.');
    }
}

function cancelSeek() {
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
    
    // Use fetch with streaming for better Kindle compatibility
    fetch(CONFIG.LICHESS_HOST + '/api/board/game/stream/' + gameId, {
        headers: { 'Authorization': 'Bearer ' + state.token }
    }).then(response => {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        function read() {
            reader.read().then(({ value, done }) => {
                if (done) {
                    console.log('Stream ended');
                    return;
                }
                
                const text = decoder.decode(value);
                const lines = text.split('\n').filter(l => l.trim());
                
                for (const line of lines) {
                    try {
                        const event = JSON.parse(line);
                        handleGameEvent(event);
                    } catch (e) {}
                }
                
                read();
            }).catch(err => {
                console.error('Stream error:', err);
            });
        }
        
        read();
    }).catch(err => {
        console.error('Failed to stream game:', err);
        $('game-status').textContent = 'Connection failed';
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
    
    // Find king in check
    let kingInCheck = null;
    // Simple check detection - find if king is attacked
    // For now, skip this (server shows it in events)
    
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
        const response = await fetch(
            CONFIG.LICHESS_HOST + '/api/board/game/' + state.currentGame.id + '/move/' + uci,
            {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + state.token }
            }
        );
        
        if (!response.ok) {
            console.error('Move rejected');
            // Move will be rejected, stream will update with correct state
        }
    } catch (err) {
        console.error('Failed to send move:', err);
    }
}

// ============================================
// Game Actions
// ============================================

async function resign() {
    if (!confirm('Are you sure you want to resign?')) return;
    
    try {
        await fetch(
            CONFIG.LICHESS_HOST + '/api/board/game/' + state.currentGame.id + '/resign',
            {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + state.token }
            }
        );
    } catch (err) {
        console.error('Failed to resign:', err);
    }
}

async function offerDraw() {
    try {
        await fetch(
            CONFIG.LICHESS_HOST + '/api/board/game/' + state.currentGame.id + '/draw/yes',
            {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + state.token }
            }
        );
        alert('Draw offer sent');
    } catch (err) {
        console.error('Failed to offer draw:', err);
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

async function init() {
    setupEventHandlers();
    
    // Show loading screen first
    showScreen('screen-loading');
    
    // Check for OAuth callback
    if (window.location.search.includes('code=')) {
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
        showScreen('screen-login');
    }
}

// Start app when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
