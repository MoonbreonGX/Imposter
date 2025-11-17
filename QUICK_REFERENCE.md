# ⚡ Quick Reference Card - Online Multiplayer

## 🎯 Feature Overview at a Glance

```
FEATURE          STATUS    WHERE                EXAMPLE
─────────────────────────────────────────────────────────────
Room Codes       ✅ DONE   play.html #onlineLobby    ABC123
 # Quick Start Guide - Admin & Currency Features
Join Room        ✅ DONE   game.js startBtn           paste code
Player List      ✅ DONE   online.js updateUI         👑 Alice, Bob
Role Notify      ✅ DONE   play.html #roleNotif      CIVILIAN
Chat             ✅ DONE   online.js sendMessage      "hello"
Voting           ✅ DONE   play.html #onlineVoting   click button
Vote Timer       ✅ DONE   online.js timer            30 → 0
Vote Tally       ✅ DONE   online.js endVoting       "Accused: Bob"
Host Controls    ✅ DONE   game.js startBtn          start/skip
Responsive       ✅ DONE   style.css media            desktop/tablet/mobile
```

---

## 🎮 Player Flow (30 seconds)

```
START
  ↓
Select ONLINE mode
  ↓
Click "Start game"
  ↓
[CREATE]              [JOIN]
Create room      →    Enter code
  ↓                      ↓
Get code            Await host
  ↓                      ↓
Share with         Wait for
friends            "Start game"
  ↓                      ↓
Click "Start"    ← (30-50 players)
See role notification
  ↓
Click "OK"
  ↓
Chat for 2 minutes
  ↓
See vote buttons
  ↓
Click player
Watch timer: 30→0
  ↓
See results
  ↓
GAME OVER ✓
```

---

## 🔑 Key Objects & Methods
### OnlineGame Object
```javascript
// Create/Join
OnlineGame.createRoom(config)      → {success, roomCode}
OnlineGame.joinRoom(code)          → {success, room}
OnlineGame.leaveRoom()             → cleanup & redirect

// Game Control
OnlineGame.startGame(data)         → host only
OnlineGame.broadcastRoles(assign)  → send roles
OnlineGame.startVoting()           → host only
OnlineGame.endVotingAndTally()     → host only

// Player Actions
OnlineGame.sendChatMessage(text)   → append message
OnlineGame.submitVote(targetId)    → record vote
OnlineGame.startVotingTimer()      → countdown 30s

// Status
OnlineGame.getMyRoleInfo()         → {isImposter, word, hint}
OnlineGame.getRoomState()          → current room data
```

---

## 🎨 UI Elements Map

```
┌─ PLAY.HTML ────────────────────────────────────┐
│                                                 │
│  #setup (OFFLINE)                              │
│  ├─ Player count input                         │
│  ├─ Difficulty buttons [Easy] [Medium]         │
│  ├─ Mode toggle [Offline] [Online] ← click    │
│  └─ Start button ← click                       │
│                                                 │
│  #onlineLobby (NEW - ONLINE)                   │
│  ├─ Room Code: ABC123 (big green glow)         │
│  ├─ [Copy Code] button                         │
│  ├─ Players joined: 2/6                        │
│  │  └─ 👑 Alice (HOST)                         │
│  │  └─ Bob                                      │
│  ├─ [Start Game] ← host only                   │
│  └─ [Leave] button                             │
│                                                 │
│  #onlinePlaying (NEW)                          │
│  ├─ #roleNotification (overlay)                │
│  │  ├─ Your role: CIVILIAN                     │
│  │  ├─ Word: ELEPHANT (green glow)             │
│  │  ├─ Hint: ___                               │
│  │  └─ [OK] dismiss                            │
│  └─ .online-chat                               │
│     ├─ [Alice]: hello                          │
│     ├─ [Bob]: hi there                         │
│     ├─ Input field                             │
│  │  ├─ [Carol]                                 │
│  └─ Result: "Accused: Bob"                     │
│                                                 │
│  #role (OFFLINE - unchanged)                   │
```javascript
  roomCode: "ABC123",
  host: "p_123...",
  hostUsername: "Alice",
  players: [
    {id: "p_123...", username: "Alice", ready: true},
    {id: "p_456...", username: "Bob", ready: true}
  ],
  gameState: "lobby|playing|voting|ended",
  gameConfig: {
    playerCount: 6,
    imposterCount: 1,
    word: "ELEPHANT",
  },
  gameData: {
    roleAssignments: {
      "p_123...": {isImposter: false, word: "ELEPHANT"},
      "p_456...": {isImposter: true, hint: "Large African..."}
    },
    votes: {
      "p_123...": {targetId: "p_456...", username: "Alice"},
      "p_456...": {targetId: "p_123...", username: "Bob"}
    },
    tallies: {"p_456...": 1},
    accusedPlayerId: "p_456...",
    votingStartedAt: 1700000000
  },
  chatMessages: [
    {username: "Alice", message: "hello", id: "...", timestamp: 1700000001},
    {username: "Bob", message: "hi", id: "...", timestamp: 1700000002}
  ]
}
```

---

## 🎨 CSS Classes

```css
/* Lobby */
.online-lobby-container     /* main card */
.room-code-display          /* code section */
.code-box                   /* "ABC123" */
.player-list                /* ul element */
.player-list li             /* each player */
.player-list li.host        /* has 👑 */

/* Chat */
.online-chat                /* chat container */
.chat-messages              /* messages area */
.chat-message               /* one message */
.chat-input-container       /* input + button */

/* Voting */
.online-voting-container    /* voting area */
.voting-timer-container     /* timer section */
.timer-circle               /* SVG wrapper */
.timer-text                 /* "30" number */
.timer-progress             /* SVG circle stroke */
.vote-options-container     /* button area */
.vote-btn                   /* one button */
.vote-btn:hover             /* hover glow */
.vote-btn.voted             /* clicked button */

/* Notification */
.notification-overlay       /* dark bg */
.notification-card          /* white card */
.role-notification          /* outer wrapper */
```

---

## ⏱️ Timing Constants

```javascript
// Polling
interval: 500ms              /* room state check */

// Voting Timer
duration: 30 seconds         /* countdown */
interval: 1000ms             /* update display */

// Chat
max_messages: 100            /* per room */
scroll: auto                 /* to bottom */

// Discussion (offline setting)
duration: 120 seconds        /* 2 minutes */
```

---

## 🔄 State Transitions

```
┌─────────────────────────────────────────────┐
│ LOBBY                                       │
│ Display: Waiting for players...             │
│ Actions: Host can start, all can leave      │
│ Next: Host clicks "Start game"              │
└────────────┬────────────────────────────────┘
             │ (OnlineGame.startGame + broadcastRoles)
             ↓
┌─────────────────────────────────────────────┐
│ PLAYING                                     │
│ Phase 1: Role notification (overlay)        │
│ Phase 2: Chat discussion (2 minutes)        │
│ Actions: Send chat, host can skip           │
│ Next: Timer expires OR host skips           │
└────────────┬────────────────────────────────┘
             │ (OnlineGame.startVoting)
             ↓
┌─────────────────────────────────────────────┐
│ VOTING                                      │
│ Display: Voting timer (30 seconds)          │
│ Display: Vote buttons for all players       │
│ Actions: Click player, vote submitted       │
│ Timer: Auto-ends at 0                       │
│ Next: Host-only endVotingAndTally           │
└────────────┬────────────────────────────────┘
             │ (OnlineGame.endVotingAndTally)
             ↓
┌─────────────────────────────────────────────┐
│ ENDED                                       │
│ Display: "Accused: [PlayerName]"            │
│ Actions: New round or back home             │
└─────────────────────────────────────────────┘
```

---

## 📱 Responsive Breakpoints

```
DESKTOP        │ TABLET         │ MOBILE
1024px+        │ 768px - 1023px │ 480px - 767px
═══════════════╪════════════════╪════════════════
Vote btn:      │ Vote btn:      │ Vote btn:
300px width    │ 250px width    │ 200px width
               │                │
Code text:     │ Code text:     │ Code text:
2.4em          │ 1.8em          │ 1.4em
               │                │
Timer:         │ Timer:         │ Timer:
120px circle   │ 100px circle   │ 100px circle
```

---

## 🚀 API Examples

### Create Room
```javascript
const config = {
  playerCount: 6,
  imposterCount: 1,
  difficulty: "easy",
  word: "ELEPHANT",
  hint: "Large African animal"
};
const result = OnlineGame.createRoom(config);
// result: {success: true, roomCode: "ABC123"}
```

### Join Room
```javascript
const result = OnlineGame.joinRoom("ABC123");
// result: {success: true, room: {...}}
```

### Send Message
```javascript
OnlineGame.sendChatMessage("I think you're sus!");
// Message added to room.chatMessages[]
```

### Submit Vote
```javascript
OnlineGame.submitVote("p_456...");
// Vote stored in room.gameData.votes
```

### Start Voting
```javascript
if (OnlineGame.isHost) {
  OnlineGame.startVoting();
  OnlineGame.startVotingTimer();
}
```

---

## 🧪 Quick Test Commands

```javascript
// Check room exists
localStorage.getItem('online_room_ABC123')

// Check your ID
console.log(OnlineGame.peerId)

// Check if host
console.log(OnlineGame.isHost)

// Get current room
console.log(OnlineGame.getRoomState())

// Check timer
console.log(OnlineGame.votingTimeRemaining)

// Manual vote tally
const room = OnlineGame.getRoomState()
Object.values(room.gameData.votes).forEach(v => console.log(v))
```

---

## 🎯 Testing Checklists

### Before Launch ✅
- [ ] Room code is 6 characters
- [ ] Players can join existing room
- [ ] Chat messages send/receive
- [ ] Vote buttons clickable
- [ ] Timer counts down 30→0
- [ ] Vote results show
- [ ] Mobile layout responsive
- [ ] No console errors

### Deployment ✅
- [ ] Files uploaded (play.html, online.js, style.css, game.js)
- [ ] Browser cache cleared
- [ ] Test on Chrome/Firefox/Safari/Edge
- [ ] Test on desktop/tablet/mobile
- [ ] Monitor error logs
- [ ] Get user feedback

---

## 🆘 Troubleshooting Quick Ref

| Problem | Check | Fix |
|---------|-------|-----|
| Room code not visible | CSS hidden attribute | Remove hidden or check display |
| Timer not showing | Voting phase started? | Click skip or wait |
| Chat not updating | 500ms poll delay | Refresh or wait |
| Vote not registered | Button highlighted? | Try clicking again |
| Mobile layout broken | Media query 480px | Check CSS breakpoint |
| Copy button fails | Browser support | Check navigator.clipboard |
| Left lobby, can't rejoin | Need new code | Host creates new game |

---

## 📚 Documentation Quick Links

```
You Are Here:
DEPLOYMENT_SUMMARY.md ← START HERE

Then Read:
README_ONLINE.md .......... Quick start & overview
TESTING_GUIDE.md ......... 10 test scenarios
ONLINE_FEATURES.md ....... API reference
UI_LAYOUT.md ............ Visual diagrams
INDEX.md ............... Full navigation

Source Code:
play.html ......... UI sections
online.js ......... Game logic
game.js ........... Integration
style.css ......... Styling
```

---

## 💡 Key Takeaways

✅ **Room Codes:** 6-char alphanumeric (ABC123 style)
✅ **Real-Time:** 500ms polling + CustomEvent dispatch
✅ **Chat:** Persistent, auto-scroll, max 100 messages
✅ **Voting:** Synchronized, 30-second timer, auto-tally
✅ **Responsive:** Desktop, Tablet, Mobile support
✅ **Ready:** Production-ready for localStorage testing

---

## 🎮 Start Playing!

1. Open `play.html`
2. Click "Online" mode
3. Click "Start game"
4. Type "create" or paste room code
5. Enjoy synchronized multiplayer! 🚀

---

**Questions? See DEPLOYMENT_SUMMARY.md for support & troubleshooting**
