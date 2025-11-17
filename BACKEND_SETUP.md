# Backend Setup - Quick Start Guide

## What Was Created

A complete backend system for the Imposter game with:

1. **Authentication System**
   - User registration and login
   - JWT token-based sessions
   - Password hashing with bcryptjs

2. **Player Accounts**
   - Persistent user profiles
   - Game statistics tracking
   - Leaderboard system

3. **Game Room Management**
   - Cross-device room joining via room codes
   - Real-time room state synchronization
   - Player list management

4. **Game Data Persistence**
   - Round history recording
   - Player statistics per round
   - Points and scoring system
   - Chat message history

## Installation Steps

### 1. Install Node.js Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment

The `.env` file is already created with defaults:
- PORT=3000
- JWT_SECRET (change this in production!)

### 3. Start the Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

The server will create `imposter_game.db` automatically on first run.

### 4. Test the Backend

The frontend will automatically connect to `http://localhost:3000/api`

## File Structure

```
Imposter.html/
├── server/
│   ├── server.js          # Main server application
│   ├── package.json       # Dependencies
│   ├── .env              # Environment variables
│   ├── README.md         # Full documentation
│   └── imposter_game.db  # SQLite database (created on first run)
├── js/
│   ├── api-client.js     # Frontend API client library (NEW)
│   └── online.js         # Will be updated to use backend
└── html/
    └── play.html         # Updated with api-client.js script
```

## Next Steps

To fully integrate the backend:

1. Update `online.js` to use `GameAPI` instead of localStorage
2. Add authentication UI to account.html
3. Update leaderboards.html to fetch from backend
4. Modify room creation/joining to use backend endpoints

## Testing the API

You can test endpoints using curl:

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}'

# Create room (use token from login)
curl -X POST http://localhost:3000/api/rooms/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"gameConfig":{"word":"ELEPHANT","hint":"Big animal"}}'
```

## Important Notes

⚠️ **Development Mode Only**: The current setup uses SQLite which is fine for development/testing but not recommended for production with multiple concurrent users.

For production deployment:
- Switch to PostgreSQL or MySQL
- Generate a strong JWT_SECRET
- Enable HTTPS
- Deploy to a hosting service (Heroku, Railway, AWS, etc.)
- Configure proper CORS settings

## Troubleshooting

**"Cannot find module" error:**
```bash
npm install
```

**Port 3000 already in use:**
```bash
PORT=3001 npm start
```

**Database errors:**
```bash
rm imposter_game.db
npm start
```

## Architecture Benefits

✅ Cross-device gameplay - rooms are server-stored, not browser-local
✅ Persistent stats - scores saved even after logout
✅ Leaderboards - global player rankings
✅ Security - JWT tokens, password hashing
✅ Scalability - ready for WebSocket upgrades
✅ Extensibility - easy to add new features (seasons, achievements, etc.)
