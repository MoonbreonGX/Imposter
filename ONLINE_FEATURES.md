# Online Multiplayer Features - Implementation Summary

## ✅ Features Implemented

### 1. **Online Lobby System**
- Players can create a new room with auto-generated 6-character room codes (alphanumeric: A-Z, 0-9)
- Players can join existing rooms by entering the room code
- Real-time player list display showing all joined players with host indication
- Copy-to-clipboard button for easy room code sharing
- Host-only "Start game" button that appears when all players have joined

**UI Location:** `#onlineLobby` section in `play.html`
**Files:** `online.js` (createRoom, joinRoom methods), `play.html` (onlineLobby section)

### 2. **Real-Time State Synchronization**
- 500ms polling interval for room state updates
- localStorage-based storage (production would use WebSockets)
- CustomEvent dispatch (`onlineGameStateChange`) triggers UI updates
- Automatic state transition between: lobby → playing → voting → ended

**Implementation:** `OnlineGame.pollRoomState()` in `online.js`

### 3. **Role & Word Notification System**
- Full-screen overlay notification on game start showing:
  - Player's role (CIVILIAN or IMPOSTER)
  - Secret word for everyone to guess
  - Hint for imposters only
- Auto-dismissible with "OK" button or auto-hide option

**UI Location:** `#roleNotification` in `onlinePlaying` section
**Styling:** `.notification-card`, `.notification-overlay` in `style.css`

### 4. **Real-Time Chat System**
- Persistent message storage per room (max 100 messages)
- Send/receive chat messages during discussion phase
- Auto-scrolling on new messages
- Username attribution for each message

**Features:**
- Send via button click or Enter key
- Messages show username in cyan, content in light blue
- Automatic cleanup (keeps last 50 messages in view)

**UI Location:** `.online-chat` section in `onlinePlaying`
**Implementation:** `OnlineGame.sendChatMessage()`, `updateChatUI()` in `online.js`

### 5. **Synchronized Voting System**
- All players vote simultaneously for who they suspect is the imposter
- Vote options display all other players as buttons
- Visual feedback showing selected vote (highlighted in green)
- Host can skip discussion to go straight to voting

**Implementation:**
- `OnlineGame.submitVote(targetPlayerId)` stores vote in room.gameData.votes
- `OnlineGame.endVotingAndTally()` tallies votes and determines accused player
- Vote result display shows who was accused

**UI Location:** `#onlineVoting` section
**Styling:** `.vote-btn`, `.vote-btn.voted` in `style.css`

### 6. **Voting Timer (Online-Only)**
- Countdown timer displayed during voting phase (default: 30 seconds)
- Circular SVG progress indicator with numerical countdown
- Automatically ends voting when timer reaches 0 (host-only)
- Timer updates every 1 second with visual feedback

**Implementation:**
- `OnlineGame.startVotingTimer()` initiates 30-second countdown
- Timer stored in `OnlineGame.votingTimeRemaining`
- Auto-end voting via `OnlineGame.endVotingAndTally()`

**UI Location:** `.voting-timer-container` with SVG circle progress
**Styling:** `@keyframes timerCountdown` in `style.css`

### 7. **Game Flow Management**
- Phase transitions handled via room.gameState:
  - **lobby**: Waiting for players, shows room code and player list
  - **playing**: Role reveal notification, then chat discussion
  - **voting**: Vote phase with timer
  - **ended**: Results displayed

**File Changes in game.js:**
- Updated `startBtn` event listener to detect online mode
- Routes online games to `OnlineGame.createRoom()` or `OnlineGame.joinRoom()`
- Passes game config (player count, imposters, difficulty, word, hint)

### 8. **Host-Only Controls**
- Start game button (visible only to host when ready)
- Skip discussion button (host can force voting phase)
- Access to voting timer controls

**Implementation:**
- `OnlineGame.isHost` flag determines authorization
- Host validation: `room.host === this.peerId`
- UI buttons conditionally show based on host status

## 📁 Files Modified/Created

### Modified Files:
1. **play.html** (139 → 226 lines)
   - Added `#onlineLobby` section
   - Added `#onlinePlaying` section with role notification & chat
   - Added `#onlineVoting` section with timer
   - Kept offline UI sections unchanged (backward compatible)

2. **online.js** (328 → 600+ lines)
   - Complete UI integration with state listeners
   - Added timer countdown logic
   - Enhanced room management with game config
   - UI update functions: `updateLobbyUI()`, `updatePlayingUI()`, `updateVotingUI()`
   - Event listeners for all interactive elements

3. **style.css** (709 → 1050+ lines)
   - Comprehensive styling for online UI
   - 3-level responsive design (1024px, 768px, 480px)
   - Animations: `slideInScale` (notification), `timerCountdown` (SVG progress)
   - Color scheme: cyan (#00b4ff), bright green (#00ff88), dark blue gradients

4. **game.js** (line 720-745 updated)
   - Updated start button handler to use `OnlineGame` instead of `OnlineMode`
   - Integrated game config passing to `OnlineGame.createRoom()`
   - Added random word selection for online games

## 🎮 Game Flow - Online Mode

```
1. Setup Screen
   ↓
   Player selects "Online" mode
   ↓
   Prompted: Create or Join room
   
   CREATE PATH:
   - OnlineGame.createRoom(gameConfig) → generates 6-char code
   - Room stored in localStorage as `online_room_${code}`
   - Enters Lobby Screen
   
   JOIN PATH:
   - Enter room code
   - OnlineGame.joinRoom(code) → adds player to room.players[]
   - Enters Lobby Screen
   
2. Lobby Screen (waiting for players)
   - Show room code (display + copy button)
   - Show player list with host status
   - Host only: Start button appears when playerCount met
   - All players: Leave button
   
3. Playing Screen (role reveal + chat)
   - Role notification overlay shows:
     * Role (CIVILIAN/IMPOSTER)
     * Word to guess
     * Hint (imposters only)
   - Chat area for discussion (all players can see)
   - Host sees skip button (optional)
   
4. Voting Screen (synchronized voting with timer)
   - 30-second countdown timer (SVG circle + number)
   - Vote buttons for each player
   - Selected vote highlighted in green
   - Auto-end at timer 0 (host auto-submits)
   - Show accused player result
   
5. End Screen
   - Display game outcome
   - Option: New round or back to home
```

## 🔌 API Reference - OnlineGame Object

### Core Methods:
- `OnlineGame.init(username)` - Initialize online mode with username
- `OnlineGame.createRoom(gameConfig)` - Create new room, returns `{ success, roomCode }`
- `OnlineGame.joinRoom(roomCode)` - Join existing room, returns `{ success, room }`
- `OnlineGame.getRoomState()` - Get current room object
- `OnlineGame.pollRoomState()` - Check for updates and dispatch CustomEvent
- `OnlineGame.leaveRoom()` - Leave room and cleanup

### Game Control:
- `OnlineGame.startGame(gameData)` - Host only: Begin game, broadcast to all players
- `OnlineGame.broadcastRoles(roleAssignments)` - Host only: Send role assignments
- `OnlineGame.startVoting()` - Host only: Start voting phase
- `OnlineGame.skipDiscussion()` - Host only: Skip to voting immediately

### Player Actions:
- `OnlineGame.sendChatMessage(text)` - Send chat message to room
- `OnlineGame.submitVote(targetPlayerId)` - Vote for a player
- `OnlineGame.submitClue(clueText)` - Submit a clue (optional)

### Utilities:
- `OnlineGame.getMyRoleInfo()` - Get my role and word info
- `OnlineGame.getPlayerById(playerId)` - Look up player details
- `OnlineGame.startVotingTimer()` - Begin 30-second voting countdown

## 💾 Data Structure - Room Storage

```javascript
{
  roomCode: "ABC123",
  host: "p_1234567890_xyz",
  hostUsername: "Alice",
  gameConfig: {
    playerCount: 6,
    imposterCount: 1,
    difficulty: "easy",
    discussionDuration: 120,
    word: "ELEPHANT",
    hint: "Large African animal"
  },
  players: [
    { id: "p_1234567890_xyz", username: "Alice", ready: true, joinedAt: 1699999999 },
    { id: "p_0987654321_abc", username: "Bob", ready: true, joinedAt: 1700000000 }
  ],
  gameState: "lobby|playing|voting|ended",
  gameData: {
    word: "ELEPHANT",
    hint: "Large African animal",
    roundStartedAt: 1700000001,
    roleAssignments: {
      "p_1234567890_xyz": { isImposter: false, word: "ELEPHANT", hint: "" },
      "p_0987654321_abc": { isImposter: true, word: "ELEPHANT", hint: "Large African animal" }
    },
    votes: {
      "p_1234567890_xyz": { username: "Alice", targetId: "p_0987654321_abc", votedAt: 1700000010 }
    },
    tallies: { "p_0987654321_abc": 1 },
    accusedPlayerId: "p_0987654321_abc",
    votingStartedAt: 1700000005
  },
  chatMessages: [
    { id: "p_1234567890_xyz1700000002", username: "Alice", message: "I think Bob is hiding", timestamp: 1700000002 }
  ],
  createdAt: 1699999999
}
```

## 🎨 UI/UX Features

### Responsive Design:
- **Desktop (1024px+):** Full-sized voting buttons, centered layout
- **Tablet (768px):** Smaller containers, mobile-friendly spacing
- **Mobile (480px):** Minimal padding, touch-friendly button sizes

### Visual Feedback:
- Glow effects on active selections (#00b4ff cyan, #00ff88 green)
- Smooth animations for notifications (slideInScale 0.4s)
- SVG timer circle with CSS stroke animation
- Color-coded messages in chat (username cyan, content light blue)

### Accessibility:
- Proper semantic HTML with `<section>`, `<button>`, `<input>`
- Aria labels on interactive elements
- Clear visual states for all buttons
- Keyboard support (Enter to send chat/vote)

## ⚙️ Technical Details

### localStorage Simulation:
```javascript
// Backend data stored as JSON in localStorage
localStorage.setItem(`online_room_${roomCode}`, JSON.stringify(room))

// Polling retrieves and broadcasts changes
const room = JSON.parse(localStorage.getItem(`online_room_${roomCode}`))
window.dispatchEvent(new CustomEvent('onlineGameStateChange', { detail: room }))
```

### Event-Driven Updates:
```javascript
window.addEventListener('onlineGameStateChange', (e) => {
  const room = e.detail
  // All UI components re-render based on room.gameState
  updateLobbyUI(room)
  updatePlayingUI(room)
  updateVotingUI(room)
})
```

### Timer Implementation:
```javascript
OnlineGame.startVotingTimer() {
  this.votingTimeRemaining = 30
  this.votingTimer = setInterval(() => {
    this.votingTimeRemaining--
    document.getElementById('votingTimerText').textContent = this.votingTimeRemaining
    if (this.votingTimeRemaining <= 0) {
      clearInterval(this.votingTimer)
      if (this.isHost) this.endVotingAndTally()
    }
  }, 1000)
}
```

## 🚀 Production Notes

### Current Implementation (localStorage):
- ✅ Works across multiple browser tabs on same machine
- ✅ Suitable for LAN/local testing
- ✅ Easy to debug (inspect localStorage in DevTools)
- ⚠️ No real-time sync if players on different machines
- ⚠️ No persistence if browser closed

### Production Upgrade (WebSocket):
To migrate to production with real-time multiplayer:
1. Replace localStorage with WebSocket server
2. Update `pollRoomState()` to listen to WebSocket messages
3. Replace `setInterval` with real-time event handlers
4. Add connection heartbeat/disconnect handling
5. Implement proper user authentication
6. Add backend validation for game state transitions

### Example WebSocket Integration:
```javascript
// Replace localStorage polling with WebSocket
socket.on('roomStateChange', (room) => {
  window.dispatchEvent(new CustomEvent('onlineGameStateChange', { detail: room }))
})

// Send actions to server instead of localStorage
socket.emit('submitVote', { roomCode, targetPlayerId })
```

## 🐛 Known Limitations & Future Enhancements

### Current Limitations:
1. Room codes never expire (cleanup needed)
2. No player timeout/disconnect handling
3. No encryption (insecure for real games)
4. No persistent history
5. No visual indication of who voted for whom

### Future Enhancements:
1. Add player disconnect recovery
2. Implement automatic room cleanup after game ends
3. Add optional round history for reviewing accusations
4. Display vote statistics after game
5. Add player level/ranking in online lobbies
6. Implement anti-cheat measures
7. Add spectator mode
8. Create tournament/season system

## 📊 Testing Checklist

- [ ] Create room generates unique 6-char code
- [ ] Multiple players can join same room (up to max)
- [ ] Room full message prevents over-joining
- [ ] Room code copy button works
- [ ] Host badge appears only for room creator
- [ ] Start button visible only to host when ready
- [ ] Game starts and shows role notification to all players
- [ ] Chat messages visible to all players immediately
- [ ] Chat input focuses after sending message
- [ ] Voting timer counts down from 30 to 0
- [ ] Voted button shows green highlight
- [ ] Vote tallies correctly with multiple voters
- [ ] Host can skip discussion
- [ ] Timer auto-ends voting at 0
- [ ] Game result (accused player) displays
- [ ] Leave button returns to home page
- [ ] Responsive layout on mobile/tablet

## 📝 Usage Instructions for Players

### Creating a Game:
1. Select "Online" mode on setup screen
2. Click "Start game"
3. Choose "create" when prompted
4. Share the room code with friends
5. Wait for all players to join
6. Click "Start game" as host

### Joining a Game:
1. Select "Online" mode on setup screen
2. Click "Start game"
3. Choose "join" when prompted
4. Enter the 6-character room code
5. Wait for host to start the game

### During Game:
1. **Role Notification:** Click "OK" to acknowledge your role/word
2. **Discussion:** Use chat to discuss and accuse (2 minutes default)
3. **Voting:** Click on the player you suspect is the imposter
4. **Results:** See who was accused, check if you won!
