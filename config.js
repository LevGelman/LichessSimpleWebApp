// Lichess OAuth Configuration
// 
// IMPORTANT: Lichess uses UNREGISTERED/PUBLIC clients!
// You do NOT need to register an app. Just pick a unique client ID.
// 
// HOW IT WORKS:
// 1. Choose a unique client_id for your app (e.g., 'kindle-chess-yourname')
// 2. That's it! No registration, no client secret needed.
// 3. Users will be redirected to Lichess to authorize your app
//
// See: https://lichess.org/api#tag/OAuth
// "Lichess supports unregistered and public clients (no client authentication, 
//  choose any unique client id)"

const CONFIG = {
    // Choose a unique client ID for your app
    // Convention: lowercase, use hyphens, make it descriptive and unique
    // Examples: 'kindle-chess-lev', 'my-chess-app-2024', 'chess-viewer-mobile'
    LICHESS_CLIENT_ID: 'kindle-lichess-client',
    
    // Redirect URI - auto-detects from current URL
    // For local testing: http://localhost:4280/
    // For Azure: https://your-app.azurestaticapps.net/
    REDIRECT_URI: window.location.origin + '/',
    
    // Lichess API endpoints
    LICHESS_HOST: 'https://lichess.org',
    
    // OAuth endpoints (for reference)
    // Authorization: https://lichess.org/oauth
    // Token exchange: https://lichess.org/api/token
    
    // Available time controls (in minutes + increment in seconds)
    TIME_CONTROLS: [
        { name: '1+0 Bullet', time: 1, increment: 0 },
        { name: '2+1 Bullet', time: 2, increment: 1 },
        { name: '3+0 Blitz', time: 3, increment: 0 },
        { name: '3+2 Blitz', time: 3, increment: 2 },
        { name: '5+0 Blitz', time: 5, increment: 0 },
        { name: '5+3 Blitz', time: 5, increment: 3 },
        { name: '10+0 Rapid', time: 10, increment: 0 },
        { name: '10+5 Rapid', time: 10, increment: 5 },
        { name: '15+10 Rapid', time: 15, increment: 10 },
        { name: '30+0 Classical', time: 30, increment: 0 }
    ],
    
    // UI Settings optimized for Kindle
    SETTINGS: {
        // Show coordinates on board edge
        showCoordinates: false,
        // Confirm moves before sending (adds extra tap)
        confirmMoves: false,
        // Low time warning threshold (seconds)
        lowTimeThreshold: 30
    }
};
