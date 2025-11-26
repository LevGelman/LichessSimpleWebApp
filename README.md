# Lichess Kindle Client

A minimal, grayscale chess client for Lichess optimized for the Amazon Kindle Paperwhite browser.

## Features

- Login with your Lichess account (OAuth2 PKCE - no backend required)
- Create games with various time controls
- Play games with click-to-move interface
- Live clock countdown
- Resume ongoing games
- Grayscale design optimized for e-ink displays
- No chat functionality
- Works on Azure Static Web Apps free tier

## Quick Start

### 1. No OAuth App Registration Needed! 🎉

**Good news!** Lichess supports unregistered/public OAuth clients. You don't need to register an app - just use any unique client ID string.

From the [Lichess API docs](https://lichess.org/api#tag/OAuth):
> "Lichess supports unregistered and public clients (no client authentication, choose any unique client id)"

The default client ID in `config.js` is `kindle-lichess-client`. You can optionally change it to something unique like `kindle-chess-yourname`.

### 2. Test Locally

```bash
# Using Python
python3 -m http.server 4280

# Using Node.js
npx serve -l 4280

# Open http://localhost:4280 in your browser
```

### 3. Deploy to Azure

See deployment instructions below.

**That's it!** No API keys, no registration, no secrets to manage.

## Deploy to Azure

### Option A: GitHub Actions (Recommended)

1. Push this code to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/lichess-kindle.git
   git push -u origin main
   ```

2. Create Azure Static Web App:
   - Go to [Azure Portal](https://portal.azure.com)
   - Create new "Static Web App"
   - Choose **Free** plan
   - Connect to your GitHub repository
   - Build preset: **Custom**
   - App location: `/`
   - Leave API and output locations empty

3. Azure will automatically:
   - Create the GitHub Actions workflow
   - Deploy on every push

4. Get your deployment token:
   - Go to your Static Web App in Azure Portal
   - Settings → Manage deployment token
   - Copy the token
   - In GitHub, go to Settings → Secrets → Actions
   - Add secret `AZURE_STATIC_WEB_APPS_API_TOKEN` with the token

### Option B: Manual Deployment

```bash
# Install Azure SWA CLI
npm install -g @azure/static-web-apps-cli

# Get deployment token from Azure Portal
# (Static Web App → Settings → Manage deployment token)

# Deploy
swa deploy . --deployment-token YOUR_TOKEN
```

## File Structure

```
├── index.html              # Single page HTML structure
├── style.css               # Grayscale Kindle-optimized styles
├── app.js                  # All application logic (~500 lines)
├── config.js               # Configuration (client ID, time controls)
├── staticwebapp.config.json # Azure SWA routing config
├── .env.example            # Environment variables template
├── .gitignore              # Git ignore rules
├── .github/
│   └── workflows/
│       └── azure-static-web-apps.yml  # CI/CD workflow
└── README.md               # This file
```

## Configuration Options

In `config.js`, you can customize:

```javascript
// Pick any unique client ID - no registration needed!
LICHESS_CLIENT_ID: 'kindle-lichess-client',

// UI settings
CONFIG.SETTINGS = {
    showCoordinates: false,    // Board coordinates
    confirmMoves: false,       // Require confirmation tap
    lowTimeThreshold: 30       // Seconds for low-time warning
};
```

## How OAuth Works (No Registration!)

Lichess uses a simplified OAuth2 PKCE flow:

1. **You pick a client ID** - Any unique string (e.g., `my-chess-app`)
2. **User clicks "Login"** - Redirected to `lichess.org/oauth`
3. **User authorizes** - Grants `board:play` scope
4. **Redirected back** - With authorization code
5. **Token exchange** - Code exchanged for access token at `lichess.org/api/token`
6. **Done!** - Token stored in localStorage, valid for ~1 year

No client secret, no app registration, no redirect URI whitelist needed.

## Kindle Browser Notes

The Kindle Paperwhite experimental browser has limitations. This app is designed to work within them:

- **No ES6 modules** - All code in plain JS files
- **HTTP streaming** instead of WebSocket - More reliable
- **No animations** - E-ink refresh is slow
- **High contrast** - Black/white/gray only
- **Large touch targets** - 44px minimum for buttons
- **Simple CSS** - Avoids features unsupported on WebKit

### Testing on Kindle

1. Deploy to Azure (HTTPS required)
2. On Kindle: Settings → Experimental Browser
3. Navigate to your Azure URL
4. Bookmark for easy access

## Troubleshooting

### OAuth redirect error
- Make sure you're testing from `http://localhost:4280/` or your deployed Azure URL
- Check browser console for errors

### Moves not registering
- The server validates all moves - if rejected, board resets to correct state
- Check your internet connection

### Clock not updating
- Clocks update every second during the active player's turn
- If stuck, refresh the page

### Game not loading
- Lichess uses HTTP streaming - some browsers struggle with this
- Try refreshing or restarting the browser

## API Reference

This app uses the [Lichess Board API](https://lichess.org/api#tag/Board):

- `POST /api/board/seek` - Create a game seek
- `GET /api/board/game/stream/{gameId}` - Stream game events
- `POST /api/board/game/{gameId}/move/{move}` - Make a move
- `POST /api/board/game/{gameId}/resign` - Resign
- `POST /api/board/game/{gameId}/draw/yes` - Offer draw

OAuth endpoints:
- `GET /oauth` - Authorization endpoint
- `POST /api/token` - Token exchange endpoint

## License

MIT - Use freely for personal projects.

## Contributing

Contributions welcome! Focus areas:
- Improved Kindle compatibility
- Offline support (Service Worker)
- Touch gesture improvements
