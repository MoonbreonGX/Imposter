# Online Multiplayer UI Layout & Flow

## Page Structure Overview

```
play.html
├── #setup (offline mode setup - existing)
│   ├── Player count input
│   ├── Imposter count input
│   ├── Player names inputs
│   ├── Difficulty buttons (Easy/Medium)
│   ├── Mode toggle (Offline/Online) ← USER SELECTS ONLINE
│   └── Start button
│
├── #onlineLobby (NEW - shown after "Online" + "Start game")
│   ├── "Waiting for players..." heading
│   ├── Room Code Display
│   │   ├── "Room Code:" label
│   │   ├── 6-char code box (highlighted in green)
│   │   └── Copy button
│   ├── Player List
│   │   ├── "Players joined (X/6)" counter
│   │   └── Player items (with 👑 for host)
│   └── Lobby Actions
│       ├── "Start game" button (host only, appears when ready)
│       ├── "You are the host" notice (host only)
│       └── Leave button
│
├── #onlinePlaying (shown when gameState='playing')
│   ├── Role Notification (overlay)
│   │   ├── Dark overlay background
│   │   └── Card showing:
│   │       ├── Role (CIVILIAN or IMPOSTER)
│   │       ├── Word (large, glowing green)
│   │       ├── Hint (only for imposters)
│   │       └── OK button
│   │
│   └── Discussion Chat Area
│       ├── "Discussion" heading
│       ├── Chat Messages Container
│       │   └── Each message: "[Username]: message text"
│       └── Chat Input
│           ├── Text input field
│           └── Send button
│
├── #onlineVoting (shown when gameState='voting')
│   ├── "Vote the Imposter" heading
│   ├── Voting Timer (circular SVG)
│   │   ├── SVG circle with progress ring
│   │   └── "30" countdown number (center)
│   ├── Vote Options
│   │   └── List of player buttons (up to 10)
│   │       ├── Normal: cyan border, light text
│   │       └── Voted: green background, green text
│   ├── Vote Result (text)
│   │   └── "Accused: [PlayerName]"
│   └── New Round button (appears after voting)
│
└── #role (offline mode - unchanged)
    ├── Role reveal card (shown when offline)
    └── (not shown during online play)
```

## State Transitions & UI Display

```
User Flow:
┌─────────────────────────────────────────┐
│        Setup Screen (#setup)            │
│  - Visible: All setup controls          │
│  - Hidden: Online sections              │
└────────────────┬────────────────────────┘
                 │ (Select Online mode)
                 ↓
         ┌───────────────────────────────────────┐
         │  Prompt Dialog                        │
         │  Create room or Join?                 │
         │  "create" or "ROOMCODE"               │
         └───────────────────────────────────────┘
                 │
    ┌────────────┴────────────┐
    │ (if "create")           │ (if join "ROOMCODE")
    ↓                         ↓
CREATE ROOM                JOIN ROOM
│                           │
└───────┬────────────┬──────┘
        │            │
        ↓            ↓
┌──────────────────────────────────────────────┐
│       Lobby State (#onlineLobby)             │
│  gameState = 'lobby'                         │
│                                              │
│  - Room code displayed (large, copyable)     │
│  - Player list shown with names              │
│  - Host: sees "You are the host" + button    │
│  - Non-host: sees other players waiting      │
│  - All: see Leave button                     │
│                                              │
│  Polling Updates Room State Every 500ms      │
│  Shows Real-Time Player Joins                │
└────────────┬─────────────────────────────────┘
             │ (Host clicks "Start game" when ready)
             │ OnlineGame.startGame() + broadcastRoles()
             ↓
┌──────────────────────────────────────────────┐
│    Playing State (#onlinePlaying)            │
│  gameState = 'playing'                       │
│                                              │
│  Phase 1: Role Notification                  │
│  ┌────────────────────────────────┐          │
│  │  Overlay with card showing:     │          │
│  │  Role: CIVILIAN or IMPOSTER     │          │
│  │  Word: ELEPHANT (green glow)    │          │
│  │  Hint: (only for imposters)     │          │
│  │  [OK button]                    │          │
│  └────────────────────────────────┘          │
│              ↓ (click OK)                    │
│  Notification hides                          │
│                                              │
│  Phase 2: Chat Discussion                    │
│  ┌────────────────────────────────┐          │
│  │  Discussion                     │          │
│  │  ┌──────────────────────────┐   │          │
│  │  │ Alice: I think Bob did it│   │          │
│  │  │ Bob: I'm not the imposter│   │          │
│  │  │ Carol: Who's suspicious? │   │          │
│  │  └──────────────────────────┘   │          │
│  │  [Input field] [Send button]    │          │
│  └────────────────────────────────┘          │
│                                              │
│  (Host sees Skip button to go to voting)     │
└────────────┬─────────────────────────────────┘
             │ (Discussion duration expires or host skips)
             │ OnlineGame.startVoting()
             ↓
┌──────────────────────────────────────────────┐
│     Voting State (#onlineVoting)             │
│  gameState = 'voting'                        │
│                                              │
│  Timer Display (Circular SVG)                │
│  ┌────────────────────────────────┐          │
│  │   ╱─────────────╲              │          │
│  │  │     30        │              │          │
│  │   ╲─────────────╱              │          │
│  │   (Circle with 30-sec countdown) │        │
│  └────────────────────────────────┘          │
│              ↓ (counts down every second)    │
│  Vote Options (all players as buttons)       │
│  ┌────────────────────────────────┐          │
│  │ [Alice]                         │          │
│  │ [Bob]           ← selected      │          │
│  │ [Carol]                         │          │
│  │ [David]                         │          │
│  │ [Eve]                           │          │
│  │ [Frank]                         │          │
│  └────────────────────────────────┘          │
│              ↓ (click to vote)               │
│  Vote highlights when selected (green)       │
│  Auto-submit when timer reaches 0            │
│                                              │
│  Result Text                                 │
│  "Accused: Bob"                              │
└────────────┬─────────────────────────────────┘
             │ (Show results, prepare next round)
             ↓
┌──────────────────────────────────────────────┐
│        Victory Screen                        │
│  (Existing #victoryAnimation)                │
│  - Show accusation result                    │
│  - Score calculation                         │
│  - [New Round] or [Back to Home]             │
└──────────────────────────────────────────────┘
```

## CSS Responsive Breakpoints

```
DESKTOP (1024px and above)
┌──────────────────────────────────┐
│        ONLINE LOBBY              │
│  Room Code Box: Large font       │
│  Players: Grid layout            │
│  Buttons: Full width             │
└──────────────────────────────────┘

TABLET (768px - 1023px)
┌────────────────────┐
│   ONLINE LOBBY     │
│  Room Code: Medium │
│  Players: Stacked  │
│  Buttons: 80% wide │
└────────────────────┘

MOBILE (480px - 767px)
┌─────────────────┐
│  ONLINE LOBBY   │
│ Code: Small     │
│ Players: List   │
│ Buttons: 90%    │
└─────────────────┘
```

## Color Scheme & Visual States

```
Primary Colors:
├── Cyan Accent: #4ac9ff (headings, primary UI)
├── Bright Cyan: #00b4ff (borders, highlights)
├── Bright Green: #00ff88 (active states, success)
├── Dark Blue: #041228, #061226 (backgrounds)
└── Light Text: #e0f7ff (main text)

Component States:

Vote Button:
  Normal:  [Button text] (cyan border, light text)
  Hover:   [Button text] (cyan glow, move right)
  Voted:   [Button text] (green background, green text, glowing)

Room Code Box:
  Display: "ABC123" (large monospace, green glow, centered)

Chat Message:
  Format: "[Username in cyan]: [message in light blue]"

Timer Circle:
  Background: Faint cyan circle
  Progress:   Bright cyan animated stroke
  Number:     "30" in large green text with glow

Notification Card:
  Role:    "CIVILIAN" / "IMPOSTER" (large, green glowing)
  Word:    "ELEPHANT" (1.2em, light blue)
  Hint:    "[hint text]" (small, gray)
  Overlay: Dark semi-transparent background
```

## Interaction Flows

### Creating a Room:
```
User clicks "Online" mode
    ↓
User clicks "Start game"
    ↓
Prompt: "Create new lobby or join existing? (Type create or room code)"
    ↓
User types: "create"
    ↓
OnlineGame.createRoom(config)
    ↓
Room created in localStorage with unique 6-char code
    ↓
Room code displayed: "ABC123"
    ↓
User sees "Share this with friends!"
    ↓
Copy button ready to share room code
```

### Joining a Room:
```
User clicks "Online" mode
    ↓
User clicks "Start game"
    ↓
Prompt: "Create new lobby or join existing? (Type create or room code)"
    ↓
User pastes/types: "ABC123"
    ↓
OnlineGame.joinRoom("ABC123")
    ↓
Added to existing room's player list
    ↓
Room displayed with all players including new player
    ↓
Host sees updated count (e.g., "Players joined (2/6)")
    ↓
Host clicks "Start game" when ready
```

### Voting Process:
```
All players in lobby
    ↓
Host clicks "Start game"
    ↓
Game starts, gameState = 'playing'
    ↓
Role notification shown to each player
    ↓
Chat discussion phase (2 minutes default)
    ↓
Host clicks "Skip to voting" or timer expires
    ↓
gameState = 'voting'
    ↓
Voting screen appears with:
  - 30-second countdown timer
  - List of player vote buttons
    ↓
Players click buttons to vote
    ↓
Timer reaches 0 automatically ends voting
    ↓
Votes tallied: who got most votes?
    ↓
Result: "Accused: [PlayerName]"
    ↓
Ready for next round or end game
```

## localStorage Structure Visualization

```
browser localStorage
│
├── online_room_ABC123 (example room)
│   └── JSON object:
│       {
│         roomCode: "ABC123",
│         host: "p_1234567890_xyz",
│         hostUsername: "Alice",
│         players: [
│           {id: "p_1...", username: "Alice", joined: timestamp},
│           {id: "p_2...", username: "Bob", joined: timestamp}
│         ],
│         gameState: "lobby|playing|voting|ended",
│         chatMessages: [
│           {username: "Alice", message: "Anyone sus?", id: "..."},
│           {username: "Bob", message: "Not me", id: "..."}
│         ],
│         gameData: {
│           word: "ELEPHANT",
│           roleAssignments: {...},
│           votes: {...},
│           votingStartedAt: timestamp
│         }
│       }
│
└── other online_room_* entries for other games
```

## Event Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│        500ms Polling Loop                           │
│   OnlineGame.pollRoomState()                        │
└────────────────────┬────────────────────────────────┘
                     │ fetches localStorage
                     ↓
        ┌────────────────────────────┐
        │ Custom Event Dispatched    │
        │ 'onlineGameStateChange'    │
        └────────────────┬───────────┘
                         │
          ┌──────────────┼──────────────┐
          ↓              ↓              ↓
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │updateLobby│ │updatePlay│ │updateVote│
    │UI         │ │ingUI     │ │ingUI     │
    └──────────┘  └──────────┘  └──────────┘
          │              │              │
          ↓              ↓              ↓
    ┌──────────────────────────────────┐
    │  Render UI Based on gameState    │
    │  - Player list updated           │
    │  - Chat messages appended        │
    │  - Vote buttons generated        │
    │  - Timer countdown displayed     │
    └──────────────────────────────────┘
```

## Chat Message Flow

```
Player A types "Hello"
    ↓
Presses Enter or clicks Send
    ↓
OnlineGame.sendChatMessage("Hello")
    ↓
Message added to room.chatMessages array
    ↓
room updated in localStorage
    ↓
Next polling cycle (500ms):
    ↓
updateChatUI(room) called
    ↓
New message rendered:
  [Player A in cyan]: Hello [in light blue]
    ↓
Auto-scroll to bottom
    ↓
All other players see it in 500ms or less
```

## Voting State Machine

```
VOTING PHASE STARTS:
├── Host calls OnlineGame.startVoting()
├── gameState = 'voting'
├── room.gameData.votes = {}
├── room.gameData.votingStartedAt = now
└── OnlineGame.startVotingTimer() begins

TIMER COUNTING:
├── Every 1000ms: votingTimeRemaining--
├── Timer display updates: "30" → "29" → "28" ...
└── SVG circle animates (stroke-dashoffset)

PLAYER VOTING:
├── Player clicks vote button
├── OnlineGame.submitVote(targetId)
├── room.gameData.votes[peerId] = {targetId, ...}
└── Button changes to green (voted state)

TIMER EXPIRES:
├── votingTimeRemaining reaches 0
├── If isHost: OnlineGame.endVotingAndTally()
├── Count votes: vote tallies calculated
├── Determine accused: player with most votes
└── gameState = 'ended'

RESULTS DISPLAYED:
├── onlineVoteResult text: "Accused: [PlayerName]"
├── Can show victory condition
└── Ready for next round
```
