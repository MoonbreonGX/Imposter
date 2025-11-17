# Imposter Game Backend Server

This is the backend server for the Imposter multiplayer game, providing:

- Player authentication and account management
- Cross-device gameplay support
- Persistent player statistics and leaderboards
- Game room management
- Real-time chat (via polling or WebSockets)
- Game round history and analytics

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables (edit `.env`):
```
PORT=3000
JWT_SECRET=your-secret-key-change-in-production
NODE_ENV=development
```

### Running the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will run on `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new player
- `POST /api/auth/login` - Login player

### Player Stats
- `GET /api/player/:playerId/stats` - Get player statistics
- `GET /api/leaderboard?limit=100` - Get global leaderboard

### Game Rooms
- `POST /api/rooms/create` - Create new game room
- `POST /api/rooms/join` - Join existing room by code
- `GET /api/rooms/:roomId` - Get room details and players
- `PUT /api/rooms/:roomId/state` - Update room state

### Chat
- `POST /api/rooms/:roomId/chat` - Send chat message
- `GET /api/rooms/:roomId/chat` - Get room chat history

### Game Rounds
- `POST /api/rounds` - Record completed round
- `GET /api/rooms/:roomId/history` - Get room game history

## Database Schema

The server uses SQLite with the following tables:

- **players** - User accounts and statistics
- **game_rooms** - Active game rooms
- **room_players** - Player memberships in rooms
- **game_rounds** - Completed game rounds
- **player_stats** - Per-round player statistics
- **chat_messages** - Chat message history

## Security

- Passwords are hashed using bcryptjs
- JWT tokens for session management
- CORS enabled for frontend communication
- Environment variables for sensitive data

## Frontend Integration

Include the API client in your HTML:
```html
<script src="./js/api-client.js"></script>
```

Use the global `GameAPI` object:
```javascript
// Login
await GameAPI.login('username', 'password');

// Create room
const room = await GameAPI.createRoom(gameConfig);

// Join room
await GameAPI.joinRoom(roomCode);

// Update game state
await GameAPI.updateRoomState(roomId, 'voting', gameData);
```

## Production Deployment

For production:

1. Change `JWT_SECRET` to a strong random string
2. Use a production database (PostgreSQL recommended)
3. Enable HTTPS
4. Set `NODE_ENV=production`
5. Configure CORS for your domain
6. Use environment variables for sensitive data
7. Consider using a hosting service like Heroku, Railway, or AWS

## Future Enhancements

- WebSocket support for real-time updates
- Room password protection
- Friend lists and invitations
- Game season rewards
- Custom word pack uploads
- Replay system
- Mobile app support
