# Online Multiplayer Testing Guide

## Quick Start - Testing Online Features

### Prerequisites
- Two or more browser tabs (simulates multiple players)
- Same browser/machine (uses localStorage for data sharing)
- JavaScript enabled
- Modern browser (Chrome, Firefox, Safari, Edge)

---

## Test Scenario 1: Create & Join Room

### Setup
1. **Tab 1 (Alice - Host):**
   - Open `play.html` in Browser Tab 1
   - Login with username "Alice"
   - Go to Play page
   
2. **Tab 2 (Bob - Player):**
   - Open `play.html` in Browser Tab 2
   - Login with username "Bob"
   - Go to Play page

### Test Steps
1. **Tab 1 - Create Room:**
   - Set Player Count: 3
   - Set Imposter Count: 1
   - Set Difficulty: Easy
   - Click "Online" mode button (glow effect)
   - Click "Start game"
   - When prompted: type "create"
   - Copy the 6-character room code that appears (e.g., "ABC123")
   - ✅ Verify:
     - Room code is exactly 6 alphanumeric characters
     - Code displayed in large green text
     - "Copy code" button works (optional: click to verify)
     - Lobby shows "Waiting for players..."
     - Player list shows "Alice (HOST)" with 👑
     - "You are the host" notice visible
     - "Start game" button visible
     - "Leave" button available

2. **Tab 2 - Join Room:**
   - Set Player Count: 3 (matches host)
   - Set Imposter Count: 1 (matches host)
   - Click "Online" mode button
   - Click "Start game"
   - When prompted: paste the room code
   - ✅ Verify:
     - Joins successfully (no error)
     - Lobby displays same room code
     - Player list now shows both "Alice" and "Bob"
     - Counter shows "Players joined (2/3)"
     - "Start game" button still hidden (not host)
     - Only "Leave" button visible

3. **Tab 1 - Check Updated Lobby:**
   - Within 500ms: Player list updates to show Bob
   - Counter updates to "Players joined (2/3)"
   - "Start game" button still hidden (need 3 players)
   - ✅ Verify: Real-time polling works

4. **Tab 2 - Add Third Player (Optional):**
   - (Or simulate by checking game only starts with proper count)
   - ✅ Verify: Can't start with 2/3 players
   - "Start game" button appears for host when ready

---

## Test Scenario 2: Role Notification & Chat

### Continuing from Scenario 1
1. **Tab 1 - Start Game (Host):**
   - Click "Start game" button
   - ✅ Verify:
     - Lobby disappears
     - Playing screen appears
     - Role notification overlay appears with:
       - Role: "CIVILIAN" or "IMPOSTER"
       - Word: Large glowing green text (e.g., "ELEPHANT")
       - Hint: Shows for imposter, empty for civilian
       - "OK" button to dismiss
     - Notification is on top (highest z-index)

2. **Both Tabs - Acknowledge Role:**
   - Click "OK" button
   - ✅ Verify:
     - Notification disappears
     - Chat area now visible
     - Chat input field focused
     - Discussion heading shows

3. **Tab 1 (Alice) - Send Chat Message:**
   - Type in chat: "Hello Bob!"
   - Press Enter (or click Send button)
   - ✅ Verify:
     - Message appears immediately
     - Format: "[Alice]: Hello Bob!" (Alice in cyan, message in light blue)
     - Input clears after send
     - Auto-scrolls to bottom

4. **Tab 2 (Bob) - Receive Message:**
   - Within 500ms: Message appears
   - ✅ Verify:
     - "[Alice]: Hello Bob!" visible
     - Received at same time as sent
     - Can see message even though not sender

5. **Tab 2 (Bob) - Send Response:**
   - Type: "Hi Alice!"
   - Click Send button
   - ✅ Verify:
     - Message appears in Tab 2
     - Within 500ms: appears in Tab 1
     - Chat history grows

6. **Both Tabs - Chat Persistence:**
   - Send 5-10 messages total
   - ✅ Verify:
     - All messages persist
     - No duplicates
     - Order maintained
     - Auto-scroll works

---

## Test Scenario 3: Voting with Timer

### Continuing from Scenario 2 (after chat messages)
1. **Tab 1 (Host) - Force Voting Phase:**
   - Click "Skip to voting" button (if visible)
   - OR wait for 2-minute timer to expire
   - ✅ Verify:
     - Chat area disappears
     - Voting screen appears
     - Timer circle visible with "30" in center
     - Vote buttons appear for each player

2. **Timer Countdown:**
   - ✅ Verify:
     - Timer starts at 30 seconds
     - Counts down every 1 second: 30 → 29 → 28 ...
     - SVG circle animates (stroke fills from top)
     - Green glow on timer number
     - Timing is accurate (approximately)

3. **Tab 1 (Alice) - Vote:**
   - Look for buttons: [Alice], [Bob], [Carol] (or third player)
   - Click [Bob]
   - ✅ Verify:
     - Button highlights in green
     - Text color changes to green
     - Button gets "voted" class
     - Vote registered (visible in console if checked)

4. **Tab 2 (Bob) - Vote:**
   - Click [Alice]
   - ✅ Verify:
     - Button [Alice] highlights green for Bob
     - Different from Tab 1's selection
     - Both votes independent

5. **Timer Countdown to Zero:**
   - Watch timer count: 10 → 5 → 4 → 3 → 2 → 1 → 0
   - When reaching 0:
     - ✅ Verify:
       - Timer stops
       - Voting ends automatically (host-only feature)
       - Results text appears: "Accused: [PlayerName]"
       - Who was accused? The player with most votes

6. **Verify Vote Tally Logic:**
   - Alice voted for Bob: 1 vote
   - Bob voted for Alice: 1 vote
   - Tie-breaker: Should pick first one alphabetically or randomly
   - ✅ Verify: Result matches expected vote tally

---

## Test Scenario 4: Room Code Validity & Errors

### Test Invalid Room Codes
1. **Tab 3 - Try Invalid Code:**
   - Open new browser tab with `play.html`
   - Login as "Carol"
   - Click "Online" mode
   - Click "Start game"
   - Type invalid code: "INVALID"
   - ✅ Verify:
     - Error message: "Failed to join: Room not found"
     - Alert dialog shows error
     - Back to setup screen

2. **Try Full Room:**
   - Create room with Player Count = 2
   - Join with Alice and Bob (full)
   - Try to join with Carol
   - ✅ Verify:
     - Error: "Failed to join: Room is full"
     - Carol cannot join

3. **Try Non-Existent Code:**
   - Type: "ZZZ999"
   - ✅ Verify:
     - Error message appears
     - No room created

---

## Test Scenario 5: Responsive Design

### Desktop (1024px+)
1. Open DevTools (F12)
2. View on full desktop
3. ✅ Verify:
   - Vote buttons: ~300px wide, centered
   - Room code: Large 2.4em font
   - Chat: Full width, readable
   - Timer: Large 120px circle
   - Lobby: Max-width 500px, centered

### Tablet (768px)
1. DevTools → Toggle device toolbar
2. Select "iPad" or set width to 768px
3. ✅ Verify:
   - Room code: 1.8em font (smaller)
   - Vote buttons: ~250px wide
   - Chat: fits screen with padding
   - Timer: 100px circle
   - No horizontal scroll

### Mobile (480px)
1. DevTools → Set width to 480px (iPhone SE)
2. ✅ Verify:
   - Room code: 1.4em font with letter spacing
   - Vote buttons: ~200px wide
   - Chat: Full width minus padding (16px)
   - Timer: 100px circle, readable
   - Font sizes reduced but readable
   - Touch-friendly tap targets (>44px)

---

## Test Scenario 6: UI State Persistence

### Sidebar Collapse (if applicable)
1. Close notification
2. Look for hamburger menu
3. Click to collapse sidebar
4. ✅ Verify:
   - Sidebar collapses to icons
   - Game continues playing
   - Main content expands

### Page Refresh During Game
1. In middle of voting phase
2. Refresh browser (F5)
3. ✅ Verify:
   - Room connection maintained
   - Can see chat history
   - Voting still available
   - Timer position updated

---

## Test Scenario 7: Multiple Concurrent Rooms

### Run Multiple Games Simultaneously
1. **Room 1 (Room Code: ABC123):**
   - Alice, Bob in lobby
   
2. **Room 2 (Room Code: XYZ789):**
   - Carol, David in lobby

3. ✅ Verify:
   - Both rooms exist independently
   - Messages from Room 1 don't appear in Room 2
   - Voting in Room 1 doesn't affect Room 2
   - Each room has separate timer

---

## Test Scenario 8: Leave Room

### Mid-Game Leave
1. During playing phase:
   - Click "Leave" button
   - ✅ Verify:
     - Connection closed
     - Redirect to home page
     - Room cleaned up (player removed from list)

### From Lobby
1. In waiting lobby:
   - Click "Leave"
   - ✅ Verify:
     - Return to setup screen
     - Room still exists for other players

---

## Test Scenario 9: Chat Edge Cases

### Long Messages
1. Type very long message (200+ characters)
2. ✅ Verify:
   - Message wraps to multiple lines
   - No overflow or scroll issues
   - Fully visible

### Special Characters
1. Type: "Hello! 👋 @everyone #gaming"
2. ✅ Verify:
   - Emojis display correctly
   - Special chars preserved
   - Message format intact

### Rapid Messages
1. Send 5 messages in 1 second
2. ✅ Verify:
   - All messages appear
   - Order preserved
   - No duplicates
   - All visible in chat area

### Chat Scroll to Bottom
1. With chat full, send message
2. ✅ Verify:
   - Auto-scrolls to show latest message
   - Oldest messages may scroll out of view
   - Latest always visible

---

## Test Scenario 10: Visual & Animation Testing

### Notification Animation
1. Game starts, notification appears
2. ✅ Verify:
   - Smooth slide-in animation (0.4s)
   - Card scales from small to normal
   - Overlay fades in
   - No jank or flicker

### Timer Animation
1. Voting starts, timer visible
2. Watch 10 seconds of countdown
3. ✅ Verify:
   - SVG circle smoothly animates
   - No stuttering
   - Number updates every 1 second
   - Glow effect visible

### Button Hover Effects
1. Hover over vote buttons
2. ✅ Verify:
   - Cyan glow appears
   - Text color lightens
   - Subtle transform translateX
   - Smooth transition (0.2s)

### Button Active State
1. Click vote button
2. ✅ Verify:
   - Becomes green background
   - Green text
   - Glowing effect
   - Persists until timer ends

---

## Performance Testing

### Event Polling (500ms)
1. Open browser console
2. Check EventListener performance
3. ✅ Verify:
   - No excessive memory leaks
   - CPU usage minimal during polling
   - Game responsive

### Chat Message Limit
1. Send 150+ messages
2. ✅ Verify:
   - Max 100 messages kept
   - Oldest removed
   - Performance remains smooth
   - No browser slowdown

### Multiple Games Stress Test
1. Open 10 browser tabs
2. Create/join rooms in each
3. ✅ Verify:
   - localStorage handles all games
   - No data corruption
   - All tabs stay responsive
   - No crashes

---

## Browser Compatibility Testing

### Chrome/Chromium
- [ ] Room creation works
- [ ] Chat sends/receives
- [ ] Timer displays correctly
- [ ] Voting buttons clickable
- [ ] Responsive layout works
- [ ] No console errors

### Firefox
- [ ] SVG timer circle displays
- [ ] CSS animations smooth
- [ ] localStorage access works
- [ ] No compatibility warnings

### Safari
- [ ] WebKit CSS prefixes work (-webkit-)
- [ ] SVG rendering correct
- [ ] Touch events on iPad work
- [ ] Sidebar glow effect visible

### Edge
- [ ] All features identical to Chrome
- [ ] Responsive design proper
- [ ] No EdgeHTML-specific issues

---

## Debugging Checklist

### Console Checks
```javascript
// Check room exists
localStorage.getItem('online_room_ABC123')

// Check OnlineGame state
console.log(OnlineGame.roomCode)
console.log(OnlineGame.peerId)
console.log(OnlineGame.isHost)

// Check voting timer
console.log(OnlineGame.votingTimeRemaining)
```

### localStorage Inspection
1. Open DevTools → Application
2. Find "online_room_*" entries
3. ✅ Verify:
   - All expected keys present
   - Data structure correct
   - Player list accurate
   - Chat messages present
   - Votes recorded

### Network Tab (Conceptual)
- No network requests (uses localStorage)
- ✅ Verify: 0 external API calls

---

## Known Issues & Workarounds

### Issue: Timer doesn't count down
- **Cause:** votingTimer interval not started
- **Fix:** Host must initiate voting phase
- **Workaround:** Click "Skip to voting" or wait for timer

### Issue: Vote button doesn't highlight
- **Cause:** Click event not registered
- **Fix:** Double-check vote-btn class selector
- **Workaround:** Refresh and try again

### Issue: Chat messages from other tab don't appear
- **Cause:** Polling interval hasn't fired yet (500ms delay)
- **Fix:** Wait up to 500ms for update
- **Workaround:** Manually refresh (F5)

### Issue: Room code not visible
- **Cause:** CSS display:none or z-index issue
- **Fix:** Check CSS visibility in DevTools
- **Workaround:** Inspect element and verify roomCodeDisplay element

---

## Success Criteria

### All Tests Passing ✅
- [ ] Room creation generates unique 6-char code
- [ ] Players can join existing rooms
- [ ] Role notifications display correctly
- [ ] Chat messages send/receive in <500ms
- [ ] Voting buttons work for all players
- [ ] Timer counts down accurately
- [ ] Vote results tally correctly
- [ ] UI responsive on mobile/tablet/desktop
- [ ] No console errors
- [ ] Game playable from start to finish
- [ ] Smooth animations without jank
- [ ] localStorage data persists correctly

### Performance Criteria ✅
- [ ] Polling uses <5% CPU
- [ ] UI responsive (<100ms interactions)
- [ ] No memory leaks after 10+ minutes
- [ ] Handles 100+ chat messages smoothly

### UX Criteria ✅
- [ ] Button states clear (normal/hover/active)
- [ ] Copy button works intuitively
- [ ] Error messages helpful
- [ ] Timer visually clear
- [ ] Chat auto-scrolls appropriately
- [ ] Vote results obvious
- [ ] Room code easy to share

---

## Test Results Summary Template

```
Test Date: __________
Tester: __________
Browser: __________
OS: __________

Test Results:
├── Room Creation: [PASS/FAIL] _______________
├── Room Joining: [PASS/FAIL] _______________
├── Role Notification: [PASS/FAIL] _______________
├── Chat System: [PASS/FAIL] _______________
├── Voting System: [PASS/FAIL] _______________
├── Timer Countdown: [PASS/FAIL] _______________
├── Responsive Design: [PASS/FAIL] _______________
├── Performance: [PASS/FAIL] _______________
└── Overall: [PASS/FAIL] _______________

Issues Found:
1. _______________
2. _______________
3. _______________

Notes:
____________________________
____________________________
```
