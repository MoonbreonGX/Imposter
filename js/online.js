// Online multiplayer mode - Real-time game engine
// Uses localStorage + polling for state sync (production would use WebSockets/WebRTC)

const OnlineGame = {
  isHost: false,
  roomCode: null,
  peerId: null,
  username: null,
  gameState: null,
  myRole: null,
  myWord: null,
  pollInterval: null,
  chatMessages: [],
  myVote: null,
  votingTimer: null,
  votingTimeRemaining: 30,

  // Initialize online mode
  async init(username) {
    this.username = username;
    this.peerId = this.generatePeerId();
  },

  // Heartbeat to announce presence to room (called periodically)
  heartbeat() {
    if (!this.roomCode || !this.peerId) return;
    const key = `online_room_${this.roomCode}`;
    const room = JSON.parse(localStorage.getItem(key) || 'null');
    if (!room) return;
    room.playersLastSeen = room.playersLastSeen || {};
    room.playersLastSeen[this.peerId] = Date.now();
    // ensure player entry exists
    if (!room.players.find(p => p.id === this.peerId)) {
      room.players.push({ id: this.peerId, username: this.username, ready: true, joinedAt: Date.now() });
    }
    localStorage.setItem(key, JSON.stringify(room));
  },

  generatePeerId() {
    return `p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  },

  // Create a new online room
  createRoom(gameConfig) {
    this.roomCode = this.generateRoomCode();
    this.isHost = true;

    const room = {
      roomCode: this.roomCode,
      host: this.peerId,
      hostUsername: this.username,
      gameConfig,
      players: [{ id: this.peerId, username: this.username, ready: true, joinedAt: Date.now() }],
      // keep lastSeen timestamps for ping/reconnect detection
      playersLastSeen: { [this.peerId]: Date.now() },
      gameState: 'lobby',
      gameData: null,
      chatMessages: [],
      createdAt: Date.now()
    };

    localStorage.setItem(`online_room_${this.roomCode}`, JSON.stringify(room));
    this.pollInterval = setInterval(() => this.pollRoomState(), 500);
    // heartbeat to announce presence
    this.heartbeatInterval = setInterval(() => this.heartbeat(), 3000);
    console.log('Room created:', this.roomCode);
    return { success: true, roomCode: this.roomCode };
  },

  // Join an existing room
  joinRoom(roomCode) {
    const roomKey = `online_room_${roomCode}`;
    const room = JSON.parse(localStorage.getItem(roomKey));

    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    // Allow joining in lobby, playing, or clueing. Reject if game ended.
    if (room.gameState === 'ended' || room.gameState === 'voted' || !room.gameState) {
      return { success: false, error: 'Game has already finished' };
    }

    room.players.push({ id: this.peerId, username: this.username, ready: true, joinedAt: Date.now() });
    // update last seen map
    room.playersLastSeen = room.playersLastSeen || {};
    room.playersLastSeen[this.peerId] = Date.now();
    localStorage.setItem(roomKey, JSON.stringify(room));

    this.roomCode = roomCode;
    this.isHost = false;
    this.pollInterval = setInterval(() => this.pollRoomState(), 500);
    this.heartbeatInterval = setInterval(() => this.heartbeat(), 3000);
    console.log('Joined room:', roomCode);
    return { success: true, room };
  },

  // Get current room state
  getRoomState() {
    if (!this.roomCode) return null;
    try {
      return JSON.parse(localStorage.getItem(`online_room_${this.roomCode}`)) || null;
    } catch (e) {
      return null;
    }
  },

  // Poll room state for updates
  pollRoomState() {
    const room = this.getRoomState();
    if (!room) return;
    // detect disconnected players (lastSeen > 10s)
    try {
      room.players = room.players || [];
      room.playersLastSeen = room.playersLastSeen || {};
      const now = Date.now();
      const activePlayers = room.players.filter(p => {
        const last = room.playersLastSeen[p.id] || 0;
        return (now - last) < 15000; // consider active if seen within 15s
      });

      // If host hasn't been seen for a while, elect a new host
      const hostId = room.host;
      const hostLast = room.playersLastSeen && room.playersLastSeen[hostId] ? room.playersLastSeen[hostId] : 0;
      if (hostId && (now - hostLast) > 15000) {
        // pick first active player as new host
        const candidate = activePlayers[0];
        if (candidate) {
          room.host = candidate.id;
          room.hostUsername = candidate.username;
          localStorage.setItem(`online_room_${this.roomCode}`, JSON.stringify(room));
        }
      }
    } catch (e) { console.warn('pollRoomState check failed', e); }

    window.dispatchEvent(new CustomEvent('onlineGameStateChange', { detail: room }));
  },

  // Start game (host only)
  startGame(gameData) {
    const room = this.getRoomState();
    if (!room || room.host !== this.peerId) {
      return { success: false, error: 'Only host can start game' };
    }

    room.gameState = 'role';
    room.gameData = gameData;
    room.gameData.roundStartedAt = Date.now();
    room.gameData.currentClueTurn = 0;
    room.gameData.clues = {};
    room.gameData.roleRevealStartedAt = Date.now();
    localStorage.setItem(`online_room_${this.roomCode}`, JSON.stringify(room));
    return { success: true };
  },

  // Notify all players of their role
  broadcastRoles(roleAssignments) {
    const room = this.getRoomState();
    if (!room) return;
    // Ensure each assignment includes the username (helpful for lookups)
    Object.keys(roleAssignments).forEach(pid => {
      const p = room.players.find(x => x.id === pid) || {};
      roleAssignments[pid].username = roleAssignments[pid].username || p.username || '';
    });
    room.gameData.roleAssignments = roleAssignments;
    localStorage.setItem(`online_room_${this.roomCode}`, JSON.stringify(room));
  },

  // Get my role and word
  getMyRoleInfo() {
    const room = this.getRoomState();
    if (!room || !room.gameData || !room.gameData.roleAssignments) return null;

    const byId = room.gameData.roleAssignments[this.peerId];
    if (byId) return byId;

    // Fallback: try to find assignment by matching username
    const entries = Object.values(room.gameData.roleAssignments || {});
    const found = entries.find(e => e.username && e.username === this.username);
    return found || null;
  },

  // Submit a clue
  submitClue(clueText) {
    const room = this.getRoomState();
    if (!room || room.gameState !== 'playing') return { success: false };

    if (!room.gameData.clues) room.gameData.clues = {};
    room.gameData.clues[this.peerId] = { username: this.username, clue: clueText, submittedAt: Date.now() };
    localStorage.setItem(`online_room_${this.roomCode}`, JSON.stringify(room));
    return { success: true };
  },

  // Send chat message
  sendChatMessage(text) {
    const room = this.getRoomState();
    if (!room) return false;

    // Basic word filter before sending
    const filtered = filterBadWords(text);

    room.chatMessages.push({
      id: this.peerId + '_' + Date.now(),
      username: this.username,
      message: filtered,
      original: text,
      timestamp: Date.now()
    });

    if (room.chatMessages.length > 100) room.chatMessages.shift();
    localStorage.setItem(`online_room_${this.roomCode}`, JSON.stringify(room));
    return true;
  },

  // Advance from role reveal to clueing phase (host only)
  advanceFromRoleReveal() {
    const room = this.getRoomState();
    if (!room || room.host !== this.peerId) return { success: false };

    room.gameState = 'clueing';
    room.gameData.cluePhaseStartedAt = Date.now();
    localStorage.setItem(`online_room_${this.roomCode}`, JSON.stringify(room));
    return { success: true };
  },

  // Start voting phase (host only)
  startVoting() {
    const room = this.getRoomState();
    if (!room || room.host !== this.peerId) return { success: false };

    room.gameState = 'voting';
    room.gameData.votes = {};
    room.gameData.votingStartedAt = Date.now();
    localStorage.setItem(`online_room_${this.roomCode}`, JSON.stringify(room));
    return { success: true };
  },

  // Submit a vote
  submitVote(targetPlayerId) {
    const room = this.getRoomState();
    if (!room || room.gameState !== 'voting') return { success: false };

    if (!room.gameData.votes) room.gameData.votes = {};
    room.gameData.votes[this.peerId] = { username: this.username, targetId: targetPlayerId, votedAt: Date.now() };
    localStorage.setItem(`online_room_${this.roomCode}`, JSON.stringify(room));
    this.myVote = targetPlayerId;
    return { success: true };
  },

  // Check if all players have voted
  allVotesCast() {
    const room = this.getRoomState();
    if (!room) return false;
    const votes = room.gameData.votes || {};
    return Object.keys(votes).length === room.players.length;
  },

  // End voting and tally (host only)
  endVotingAndTally() {
    const room = this.getRoomState();
    if (!room || room.host !== this.peerId) return { success: false };

    const votes = room.gameData.votes || {};
    const tallies = {};
    const roleAssignments = room.gameData.roleAssignments || {};
    
    room.players.forEach(p => { tallies[p.id] = 0; });

    Object.values(votes).forEach(vote => {
      if (tallies.hasOwnProperty(vote.targetId)) {
        tallies[vote.targetId]++;
      }
    });

    // Determine who was accused (most votes, ties go to first)
    const maxVotes = Math.max(...Object.values(tallies));
    const accused = Object.keys(tallies).find(k => tallies[k] === maxVotes);

    // Check if accused was actually impostor
    const accusedRole = roleAssignments[accused] ? roleAssignments[accused].role : null;
    const wasImposter = accusedRole === 'imposter';

    // Calculate points based on outcome
    const pointsEarned = {};
    room.players.forEach(p => {
      pointsEarned[p.id] = 0;
      const role = roleAssignments[p.id] ? roleAssignments[p.id].role : 'civilian';
      
      if (wasImposter) {
        // Civilians win: all civilians get 10 points, impostor gets -5
        pointsEarned[p.id] = (role === 'civilian') ? 10 : -5;
      } else {
        // Impostor survives: impostor gets 15 points, accused civilian gets -5, others get 2
        if (role === 'imposter') {
          pointsEarned[p.id] = 15;
        } else if (p.id === accused) {
          pointsEarned[p.id] = -5;
        } else {
          pointsEarned[p.id] = 2;
        }
      }
    });

    // Store reveal data
    room.gameData.tallies = tallies;
    room.gameData.accusedPlayerId = accused;
    room.gameData.accusedRole = accusedRole;
    room.gameData.wasImposter = wasImposter;
    room.gameData.pointsEarned = pointsEarned;
    room.gameData.secretWord = room.gameConfig.word;
    room.gameState = 'ended';
    localStorage.setItem(`online_room_${this.roomCode}`, JSON.stringify(room));
    return { success: true, tallies, accused, wasImposter, pointsEarned };
  },

  // Skip discussion (host only)
  skipDiscussion() {
    const room = this.getRoomState();
    if (!room || room.host !== this.peerId) return { success: false };
    this.startVoting();
    return { success: true };
  },

  // Get player by ID
  getPlayerById(playerId) {
    const room = this.getRoomState();
    if (!room) return null;
    return room.players.find(p => p.id === playerId);
  },

  // Leave room
  leaveRoom() {
    if (!this.roomCode) return;
    const room = this.getRoomState();
    if (!room) return;

    room.players = room.players.filter(p => p.id !== this.peerId);

    if (room.host === this.peerId && room.players.length > 0) {
      room.host = room.players[0].id;
      room.hostUsername = room.players[0].username;
    }

    localStorage.setItem(`online_room_${this.roomCode}`, JSON.stringify(room));
    clearInterval(this.pollInterval);
    if (this.votingTimer) clearInterval(this.votingTimer);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.roomCode = null;
  },

  // Start voting countdown timer
  startVotingTimer() {
    this.votingTimeRemaining = 30;
    if (this.votingTimer) clearInterval(this.votingTimer);
    
    this.votingTimer = setInterval(() => {
      this.votingTimeRemaining--;
      const timerTextEl = document.getElementById('votingTimerText');
      if (timerTextEl) timerTextEl.textContent = this.votingTimeRemaining;

      // Auto-end voting when timer reaches 0
      if (this.votingTimeRemaining <= 0) {
        clearInterval(this.votingTimer);
        if (this.isHost) {
          this.endVotingAndTally();
        }
      }
    }, 1000);
  }
};

// UI Integration
document.addEventListener('DOMContentLoaded', () => {
  window.addEventListener('onlineGameStateChange', (e) => {
    const room = e.detail;
    if (!room) return;

    // update client host status
    try { OnlineGame.isHost = (room.host === OnlineGame.peerId); } catch (e) {}

    // === LOBBY STATE ===
    if (room.gameState === 'lobby') {
      updateLobbyUI(room);
    }

    // === ROLE REVEAL STATE ===
    if (room.gameState === 'role') {
      updateRoleUI(room);
    }

    // === PLAYING STATE (deprecated - use role + clueing) ===
    if (room.gameState === 'playing') {
      updatePlayingUI(room);
    }

    // === CLUEING STATE ===
    if (room.gameState === 'clueing') {
      updateClueingUI(room);
    }

    // === VOTING STATE ===
    if (room.gameState === 'voting') {
      updateVotingUI(room);
    }

    // === ENDED STATE ===
    if (room.gameState === 'ended') {
      updateEndedUI(room);
    }
  });

  // Chat input
  const chatInputEl = document.getElementById('onlineChatInput');
  const chatSendBtn = document.getElementById('onlineChatSend');
  if (chatSendBtn) {
    chatSendBtn.addEventListener('click', () => {
      const text = chatInputEl?.value.trim();
      if (text) {
        OnlineGame.sendChatMessage(text);
        chatInputEl.value = '';
      }
    });
  }
  if (chatInputEl) {
    chatInputEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const text = chatInputEl.value.trim();
        if (text) {
          OnlineGame.sendChatMessage(text);
          chatInputEl.value = '';
        }
      }
    });
  }

  // Start button
  const onlineStartBtn = document.getElementById('onlineStartBtn');
  if (onlineStartBtn) {
    onlineStartBtn.addEventListener('click', () => {
      if (OnlineGame.isHost) {
        const room = OnlineGame.getRoomState();
        if (room) {
          // Check minimum 3 players
          if (room.players.length < 3) {
            alert('Need at least 3 players to start the game');
            return;
          }

          // Generate roles and broadcast
          const imposters = [];
          for (let i = 0; i < room.gameConfig.imposterCount; i++) {
            imposters.push(room.players[i].id);
          }

          const roleAssignments = {};
          room.players.forEach((p, idx) => {
            const isImposter = imposters.includes(p.id);
            roleAssignments[p.id] = {
              username: p.username,
              isImposter: isImposter,
              word: room.gameConfig.word || 'PLACEHOLDER',
              hint: isImposter ? (room.gameConfig.hint || '') : ''
            };
          });
          console.log('HOST: Starting game with word:', room.gameConfig.word, 'roleAssignments:', roleAssignments);
          OnlineGame.startGame({ word: room.gameConfig.word, hint: room.gameConfig.hint, discussionDuration: room.gameConfig.discussionDuration || 600 });
          OnlineGame.broadcastRoles(roleAssignments);
        }
      }
    });
  }

  // Leave lobby button
  const leaveLobbyBtn = document.getElementById('leaveLobbyBtn');
  if (leaveLobbyBtn) {
    leaveLobbyBtn.addEventListener('click', () => {
      OnlineGame.leaveRoom();
      window.location.href = 'index.html';
    });
  }

  // Voting buttons wire-up (delegated)
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('vote-btn')) {
      const targetId = e.target.dataset.targetId;
      OnlineGame.submitVote(targetId);
      // Update UI to show voted state
      document.querySelectorAll('.vote-btn').forEach(btn => btn.classList.remove('voted'));
      e.target.classList.add('voted');
    }
    
    // New round button
    if (e.target.id === 'onlineNewRoundBtn') {
      if (OnlineGame.isHost) {
        const room = OnlineGame.getRoomState();
        if (room) {
          // Reset room to lobby state
          room.gameState = 'lobby';
          room.gameData = null;
          room.chatMessages = [];
          room.players.forEach(p => { p.ready = false; });
          localStorage.setItem(`online_room_${OnlineGame.roomCode}`, JSON.stringify(room));
        }
      } else {
        alert('Only the host can start a new round');
      }
    }
  });

  // Clue submission
  const submitClueBtn = document.getElementById('submitClueBtn');
  if (submitClueBtn) {
    submitClueBtn.addEventListener('click', () => {
      const clueInput = document.getElementById('clueInput');
      if (clueInput && clueInput.value.trim()) {
        OnlineGame.submitClue(clueInput.value.trim());
        clueInput.value = '';
        submitClueBtn.disabled = true;
        submitClueBtn.textContent = 'Clue submitted';

        // If host, advance to next clue turn or go to voting
        if (OnlineGame.isHost) {
          setTimeout(() => {
            const room = OnlineGame.getRoomState();
            if (!room) return;
            const nextTurn = (room.gameData?.currentClueTurn || 0) + 1;
            if (nextTurn >= room.players.length) {
              // All clues collected, move to voting
              room.gameState = 'clueing'; // stay in clueing to display all clues briefly
              room.gameData.cluePhaseComplete = true;
              // Auto-advance to voting after 3 seconds
              setTimeout(() => {
                const room2 = OnlineGame.getRoomState();
                if (room2) {
                  room2.gameState = 'voting';
                  room2.gameData.votes = {};
                  room2.gameData.votingStartedAt = Date.now();
                  localStorage.setItem(`online_room_${OnlineGame.roomCode}`, JSON.stringify(room2));
                }
              }, 3000);
            } else {
              room.gameData.currentClueTurn = nextTurn;
            }
            localStorage.setItem(`online_room_${OnlineGame.roomCode}`, JSON.stringify(room));
          }, 500);
        }
      }
    });
  }

  // Role notification dismiss
  const dismissRoleBtn = document.getElementById('dismissRoleBtn');
  if (dismissRoleBtn) {
    dismissRoleBtn.addEventListener('click', () => {
      const notifEl = document.getElementById('roleNotification');
      if (notifEl) {
        notifEl.hidden = true;
        // mark as dismissed so polling doesn't re-show repeatedly
        try { notifEl.dataset.shown = '1'; } catch (e) {}
      }
    });
  }

  // Copy room code button
  const copyRoomCodeBtn = document.getElementById('copyRoomCodeBtn');
  if (copyRoomCodeBtn) {
    copyRoomCodeBtn.addEventListener('click', () => {
      const codeBox = document.getElementById('roomCodeDisplay');
      const code = codeBox.textContent.trim();
      navigator.clipboard.writeText(code).then(() => {
        copyRoomCodeBtn.textContent = 'Copied!';
        setTimeout(() => { copyRoomCodeBtn.textContent = 'Copy code'; }, 2000);
      });
    });
  }

  // Invite friend / copy invite link
  const inviteFriendBtn = document.getElementById('inviteFriendBtn');
  if (inviteFriendBtn) {
    inviteFriendBtn.addEventListener('click', () => {
      const room = OnlineGame.getRoomState();
      if (!room) return alert('No active room');
      const url = `${window.location.origin}${window.location.pathname}?room=${room.roomCode}`;
      navigator.clipboard.writeText(url).then(() => {
        alert('Invite link copied to clipboard');
      }).catch(() => { prompt('Invite link', url); });
    });
  }

  // Skip discussion (host only) button in online playing
  const onlineSkipBtn = document.getElementById('onlineSkipDiscussionBtn');
  if (onlineSkipBtn) {
    onlineSkipBtn.addEventListener('click', () => {
      if (OnlineGame.isHost) {
        const room = OnlineGame.getRoomState();
        if (!room) return;
        // Transition to voting state
        room.gameState = 'voting';
        room.gameData = room.gameData || {};
        room.gameData.votes = {};
        room.gameData.votingStartedAt = Date.now();
        localStorage.setItem(`online_room_${OnlineGame.roomCode}`, JSON.stringify(room));
      } else {
        alert('Only the host can skip discussion');
      }
    });
  }
});

// Auto-join from invite link if ?room=CODE
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  if (roomCode) {
    // If user logged in use their username, otherwise prompt for temporary name
    const current = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
    let name = current;
    if (!name) {
      name = prompt('Enter a display name to join the invited game:', 'Guest' + Math.floor(Math.random()*9000+1000));
      if (!name) return;
    }
    await OnlineGame.init(name);
    const res = OnlineGame.joinRoom(roomCode);
    if (!res.success) alert('Failed to join room: ' + res.error);
  }
});

// Basic bad-words filter (simple list, replace with ****)
const BAD_WORDS = ['badword1','badword2','ass','shit','fuck'];
function filterBadWords(text) {
  if (!text) return text;
  let out = text;
  BAD_WORDS.forEach(w => {
    const re = new RegExp('\\b' + w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'ig');
    out = out.replace(re, (m) => '*'.repeat(m.length));
  });
  return out;
}

// Deterministic color for a username (HSL)
function getColorForName(name) {
  if (!name) return '#9fdcff';
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h},70%,60%)`;
}

// === UI UPDATE FUNCTIONS ===

function updateLobbyUI(room) {
  const lobbySection = document.getElementById('onlineLobby');
  if (!lobbySection) return;
  lobbySection.hidden = false;
  document.getElementById('setup').hidden = true;
  document.getElementById('onlinePlaying').hidden = true;
  document.getElementById('onlineVoting').hidden = true;

  // Display room code
  const codeDisplay = document.getElementById('roomCodeDisplay');
  if (codeDisplay) codeDisplay.textContent = room.roomCode;

  // Update player count
  document.getElementById('playerCount2').textContent = room.players.length;

  // Update player list
  const playerList = document.getElementById('onlinePlayerList');
  if (playerList) {
    playerList.innerHTML = '';
    room.players.forEach(p => {
      const li = document.createElement('li');
      if (room.host === p.id) li.classList.add('host');
      const nameSpan = document.createElement('span');
      nameSpan.textContent = p.username;
      nameSpan.style.color = getColorForName(p.username);
      nameSpan.style.fontWeight = '700';
      // ping indicator
      const last = (room.playersLastSeen && room.playersLastSeen[p.id]) || 0;
      const now = Date.now();
      const dot = document.createElement('span');
      dot.style.display = 'inline-block';
      dot.style.width = '10px';
      dot.style.height = '10px';
      dot.style.borderRadius = '50%';
      dot.style.marginRight = '8px';
      dot.style.marginLeft = '6px';
      if (now - last < 7000) dot.style.background = '#34D399'; else dot.style.background = '#FF6B6B';
      li.appendChild(dot);
      li.appendChild(nameSpan);
      playerList.appendChild(li);
    });
  }

  // Show start button only for host if all players joined
  const startBtn = document.getElementById('onlineStartBtn');
  const hostNotice = document.getElementById('hostNotice');
  if (startBtn && hostNotice) {
    if (OnlineGame.isHost) {
      hostNotice.style.display = 'block';
      startBtn.style.display = 'block';
    } else {
      hostNotice.style.display = 'none';
      startBtn.style.display = 'none';
    }
  }
}

function updateRoleUI(room) {
  // Show the online playing section to display role reveal
  const playingSection = document.getElementById('onlinePlaying');
  if (!playingSection) return;
  playingSection.hidden = false;
  document.getElementById('onlineLobby').hidden = true;
  document.getElementById('setup').hidden = true;
  document.getElementById('onlineVoting').hidden = true;

  // Hide clue/voting areas - only show role notification
  const clueArea = document.getElementById('clueSubmissionArea');
  const votingArea = document.getElementById('onlineVoting');
  const votingRevealArea = document.getElementById('votingRevealArea');
  if (clueArea) clueArea.hidden = true;
  if (votingArea) votingArea.hidden = true;
  if (votingRevealArea) votingRevealArea.hidden = true;

  // Show role notification
  const roleInfo = OnlineGame.getMyRoleInfo();
  if (roleInfo) {
    const notif = document.getElementById('roleNotification');
    const notifRole = document.getElementById('notifRole');
    const notifWord = document.getElementById('notifWord');
    const notifHint = document.getElementById('notifHint');

    if (notifRole) notifRole.textContent = roleInfo.isImposter ? 'IMPOSTER' : 'CIVILIAN';
    if (notifWord) {
      notifWord.textContent = roleInfo.word || 'LOADING...';
    }
    if (notifHint) notifHint.textContent = roleInfo.hint ? `Hint: ${roleInfo.hint}` : '';

    if (notif) {
      notif.hidden = false;
      notif.dataset.shown = '0'; // Reset so notification displays
    }
  }

  // Show countdown timer before transitioning to cluing
  const discussionEl = document.getElementById('onlineDiscussionTimer');
  if (discussionEl) {
    const started = room.gameData?.roleRevealStartedAt || Date.now();
    const elapsed = Math.floor((Date.now() - started) / 1000);
    const remaining = Math.max(0, 5 - elapsed); // 5 second role reveal phase
    
    discussionEl.textContent = `Advancing in ${remaining}s`;

    // Auto-advance to clueing after 5 seconds (host only)
    if (OnlineGame.isHost && remaining <= 0) {
      OnlineGame.advanceFromRoleReveal();
    }
  }

  // Hide chat and other discussion elements during role reveal
  const chatArea = document.querySelector('.online-chat');
  if (chatArea) chatArea.hidden = true;
}

function updatePlayingUI(room) {
  const playingSection = document.getElementById('onlinePlaying');
  if (!playingSection) return;
  playingSection.hidden = false;
  document.getElementById('onlineLobby').hidden = true;
  document.getElementById('setup').hidden = true;
  document.getElementById('onlineVoting').hidden = true;
  const votingRevealArea = document.getElementById('votingRevealArea');
  if (votingRevealArea) votingRevealArea.hidden = true;

  // Show role notification on first entry
  const roleInfo = OnlineGame.getMyRoleInfo();
  if (roleInfo) {
    const notif = document.getElementById('roleNotification');
    const notifRole = document.getElementById('notifRole');
    const notifWord = document.getElementById('notifWord');
    const notifHint = document.getElementById('notifHint');

    // Always ensure these elements are updated with the role info
    if (notifRole) notifRole.textContent = roleInfo.isImposter ? 'IMPOSTER' : 'CIVILIAN';
    if (notifWord) {
      const wordToShow = roleInfo.word || 'LOADING...';
      notifWord.textContent = wordToShow;
      console.log('CLIENT: Updated notifWord to:', wordToShow, 'isImposter:', roleInfo.isImposter);
    }
    if (notifHint) notifHint.textContent = roleInfo.hint ? `Hint: ${roleInfo.hint}` : '';

    try {
      // If the word changed since last time, reset the shown flag so player sees new role
      const prevWord = notif && notif.dataset ? notif.dataset.roleWord : null;
      if (prevWord !== roleInfo.word) {
        if (notif && notif.dataset) {
          notif.dataset.shown = '0';
          notif.dataset.roleWord = roleInfo.word || '';
        }
      }

      const already = notif && notif.dataset && notif.dataset.shown === '1';
      if (notif && !already) {
        notif.hidden = false;
        notif.dataset.shown = '1';
        notif.dataset.roleWord = roleInfo.word || '';
        console.log('CLIENT: Displaying role notification with word:', roleInfo.word);
      }
    } catch (e) {
      console.warn('Error updating role notification', e);
      if (notif && notif.hidden) notif.hidden = false;
    }
  }

  // Update chat
  updateChatUI(room);

  // Show discussion timer if configured
  const timerEl = document.getElementById('onlineDiscussionTimer');
  const skipBtn = document.getElementById('onlineSkipDiscussionBtn');
  if (timerEl && room.gameData && room.gameData.discussionDuration) {
    // set remaining based on roundStartedAt
    const started = room.gameData.roundStartedAt || Date.now();
    const dur = room.gameData.discussionDuration || 600;
    const elapsed = Math.floor((Date.now() - started) / 1000);
    const remaining = Math.max(0, dur - elapsed);
    const m = Math.floor(remaining/60).toString().padStart(2,'0');
    const s = Math.floor(remaining%60).toString().padStart(2,'0');
    timerEl.textContent = `${m}:${s}`;
    if (skipBtn) skipBtn.style.display = OnlineGame.isHost ? 'inline-block' : 'none';
    
    // Auto-advance to voting when timer expires (host only)
    if (OnlineGame.isHost && remaining <= 0 && room.gameState === 'playing') {
      OnlineGame.startVoting();
    }
  } else {
    if (timerEl) timerEl.textContent = '';
    if (skipBtn) skipBtn.style.display = 'none';
  }
}

function updateChatUI(room) {
  const chatContainer = document.getElementById('onlineChatMessages');
  if (!chatContainer) return;

  const scrollPos = chatContainer.scrollTop === chatContainer.scrollHeight - chatContainer.clientHeight;

  chatContainer.innerHTML = '';
  room.chatMessages.forEach(msg => {
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-message';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'player-name';
    nameSpan.textContent = msg.username + ':';
    nameSpan.style.color = getColorForName(msg.username);
    nameSpan.style.fontWeight = '700';
    nameSpan.style.marginRight = '8px';
    const textSpan = document.createElement('span');
    textSpan.className = 'message-text';
    textSpan.textContent = msg.message;
    msgEl.appendChild(nameSpan);
    msgEl.appendChild(textSpan);
    chatContainer.appendChild(msgEl);
  });

  if (scrollPos || room.chatMessages.length === 1) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

function updateVotingUI(room) {
  const votingSection = document.getElementById('onlineVoting');
  if (!votingSection) return;
  votingSection.hidden = false;
  document.getElementById('onlineLobby').hidden = true;
  document.getElementById('setup').hidden = true;
  document.getElementById('onlinePlaying').hidden = true;
  const votingRevealArea = document.getElementById('votingRevealArea');
  if (votingRevealArea) votingRevealArea.hidden = true;

  // Start timer if host
  if (OnlineGame.isHost && !OnlineGame.votingTimer) {
    OnlineGame.startVotingTimer();
  }

  // Generate vote buttons
  const voteContainer = document.getElementById('onlineVoteOptions');
  if (voteContainer && room.players.length > 0 && voteContainer.children.length === 0) {
    voteContainer.innerHTML = '';
    room.players.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'vote-btn';
      btn.dataset.targetId = p.id;
      btn.textContent = p.username;
      if (OnlineGame.myVote === p.id) btn.classList.add('voted');
      voteContainer.appendChild(btn);
    });
  }

  // IMPORTANT: Do NOT show voting reveal area here during the voting phase.
  // The reveal should only appear when gameState transitions to 'ended' in updateEndedUI()
  // Showing it here would display results immediately at the start of voting
}

function updateEndedUI(room) {
  // Safety check: only show reveal if we actually have voting data
  if (!room.gameData || !room.gameData.accusedPlayerId || !room.gameData.pointsEarned) {
    console.warn('REVEAL: Missing game data, not showing reveal yet', room.gameData);
    return;
  }
  
  // Hide other sections
  document.getElementById('setup').hidden = true;
  document.getElementById('onlineLobby').hidden = true;
  document.getElementById('onlinePlaying').hidden = true;
  document.getElementById('onlineVoting').hidden = true;
  
  // Show voting reveal area with full results
  const revealArea = document.getElementById('votingRevealArea');
  if (!revealArea) return;
  revealArea.hidden = false;
  
  // Get accused player info
  const accusedId = room.gameData.accusedPlayerId;
  const accused = room.players.find(p => p.id === accusedId);
  
  console.log('REVEAL: accusedId=', accusedId, 'accused=', accused, 'wasImposter=', room.gameData.wasImposter, 'secretWord=', room.gameData.secretWord);
  
  // Guard against undefined accused
  if (!accused) {
    revealArea.innerHTML = '<div class="reveal-card"><div style="color:#ff6b6b;">Error: Could not determine accused player</div></div>';
    return;
  }
  
  // Build reveal card with full details
  const wasImposter = room.gameData.wasImposter;
  const secretWord = room.gameData.secretWord || 'UNKNOWN';
  const myPoints = room.gameData.pointsEarned ? room.gameData.pointsEarned[OnlineGame.peerId] : 0;
  
  // Create detailed reveal content
  const revealHTML = `
    <div style="font-size:2.4em; font-weight:900; color:#4ac9ff; margin-bottom:16px;">VOTED OUT</div>
    <div style="font-size:3em; font-weight:900; color:#00ff88; text-shadow:0 0 20px rgba(0,255,136,0.6); text-transform:uppercase; margin-bottom:20px;">${accused.username}</div>
    <div style="margin-top:20px; font-size:1.1em; color:#9fdcff; margin-bottom:24px;">
      ${wasImposter ? '🎉 <strong style="color:#00ff88;">WAS THE IMPOSTOR!</strong>' : '😅 <strong style="color:#ff6b6b;">WAS NOT THE IMPOSTOR</strong>'}
    </div>
    <div style="border-top:1px solid rgba(0,217,255,0.3); padding-top:16px; margin-top:16px; text-align:left;">
      <div style="color:#9fdcff; margin-bottom:12px;">
        <strong>Secret Word:</strong> <span style="color:#00ffff; font-size:1.2em; font-weight:700;">${secretWord}</span>
      </div>
      <div style="color:#9fdcff;">
        <strong>Your Points:</strong> <span style="color:${myPoints > 0 ? '#00ff88' : '#ff6b6b'}; font-size:1.1em; font-weight:700;">${myPoints > 0 ? '+' : ''}${myPoints}</span>
      </div>
    </div>
    <button id="onlineNewRoundBtn" style="margin-top:20px; padding:12px 24px; background:linear-gradient(135deg,#00d9ff,#0099ff); color:#001; border:none; border-radius:8px; font-weight:700; cursor:pointer;">New Round</button>
  `;
  
  revealArea.innerHTML = revealHTML;
}

// === CLUEING PHASE (during discussion) ===
function updateClueingUI(room) {
  const playingSection = document.getElementById('onlinePlaying');
  if (!playingSection) return;
  playingSection.hidden = false;
  document.getElementById('onlineLobby').hidden = true;
  document.getElementById('setup').hidden = true;
  document.getElementById('onlineVoting').hidden = true;

  // Show chat area (was hidden during role reveal)
  const chatArea = document.querySelector('.online-chat');
  if (chatArea) chatArea.hidden = false;

  // Hide role notification and voting reveal
  const roleNotif = document.getElementById('roleNotification');
  const votingRevealArea = document.getElementById('votingRevealArea');
  if (roleNotif) roleNotif.hidden = true;
  if (votingRevealArea) votingRevealArea.hidden = true;

  // Update chat
  updateChatUI(room);

  // Show clue submission area for current player
  const clueArea = document.getElementById('clueSubmissionArea');
  const clueInput = document.getElementById('clueInput');
  const cluesDisplay = document.getElementById('cluesDisplayArea');
  const cluesDiv = document.getElementById('cluesDisplay');

  const currentClueTurn = room.gameData?.currentClueTurn || 0;
  const currentCluePlayer = room.players[currentClueTurn];

  if (clueArea && currentCluePlayer) {
    const isMyTurn = currentCluePlayer.id === OnlineGame.peerId;
    if (isMyTurn) {
      clueArea.hidden = false;
      document.getElementById('cluePlayerName').textContent = `${currentCluePlayer.username}, enter your clue:`;
      if (clueInput) clueInput.focus();
    } else {
      clueArea.hidden = true;
    }
  }

  // Display all submitted clues
  if (cluesDisplay && cluesDiv && room.gameData && room.gameData.clues) {
    cluesDisplay.hidden = false;
    cluesDiv.innerHTML = '';
    Object.values(room.gameData.clues).forEach(clue => {
      const clueEl = document.createElement('div');
      clueEl.className = 'clue-item';
      clueEl.innerHTML = `<div class="clue-author">${clue.username}:</div><div class="clue-text">${clue.clue}</div>`;
      cluesDiv.appendChild(clueEl);
    });
  }

  // Show discussion timer
  const timerEl = document.getElementById('onlineDiscussionTimer');
  const skipBtn = document.getElementById('onlineSkipDiscussionBtn');
  if (timerEl && room.gameData && room.gameData.discussionDuration) {
    const started = room.gameData.roundStartedAt || Date.now();
    const dur = room.gameData.discussionDuration || 600;
    const elapsed = Math.floor((Date.now() - started) / 1000);
    const remaining = Math.max(0, dur - elapsed);
    const m = Math.floor(remaining/60).toString().padStart(2,'0');
    const s = Math.floor(remaining%60).toString().padStart(2,'0');
    timerEl.textContent = `${m}:${s}`;
    if (skipBtn) skipBtn.style.display = OnlineGame.isHost ? 'inline-block' : 'none';
  }
}
