const state = {
  players: [],
  imposterIndices: [],
  secretWord: null,
  secretHint: null,
  votes: [],
  voteIdx: 0,
  voteTally: [],
  imposterCount: 1,
  selectedPacks: [],
  combinedWordPool: [],
  playerScores: [],  // Track cumulative scores: { id, name, score }
  roundNumber: 0,
};

// Add global debug tracking
if (typeof window.addDebug === 'undefined') {
  window.addDebug = function(msg) { console.log(msg); };
}
window.addDebug('game.js loaded - state initialized');

// Client-side lightweight rate limiter to slow down automated inputs
const _clientBuckets = {};
function allowAction(key, maxPerWindow = 5, windowMs = 1000) {
  const now = Date.now();
  if (!_clientBuckets[key]) _clientBuckets[key] = { reset: now + windowMs, count: 0 };
  const b = _clientBuckets[key];
  if (now > b.reset) { b.count = 0; b.reset = now + windowMs; }
  b.count++;
  return b.count <= maxPerWindow;
}

// WORDS data moved to `words.js` (shared file)

const els = {
  setup: document.getElementById("setup"),
  playerCount: document.getElementById("playerCount"),
  imposterCount: document.getElementById("imposterCount"),
  playerNames: document.getElementById("playerNames"),
  wordPacksBtn: document.getElementById("wordPacksBtn"),
  startBtn: document.getElementById("startBtn"),

  role: document.getElementById("role"),
  roleText: document.getElementById("roleText"),
  secretWordWrap: document.getElementById("secretWordWrap"),
  secretWord: document.getElementById("secretWord"),
  nextRoleBtn: document.getElementById("nextRoleBtn"),

  clues: document.getElementById("clues"),
  currentPlayerName: document.getElementById("currentPlayerName"),
  nextClueBtn: document.getElementById("nextClueBtn"),
  toVoteBtn: document.getElementById("toVoteBtn"),
  // Discussion elements (new)
  discussion: document.getElementById("discussion"),
  discussionTimer: document.getElementById("discussionTimer"),
  discussionDuration: document.getElementById("discussionDuration"),
  skipDiscussionBtn: document.getElementById("skipDiscussionBtn"),

  vote: document.getElementById("vote"),
  voteOptions: document.getElementById("voteOptions"),
  voteResult: document.getElementById("voteResult"),
  victoryAnimation: document.getElementById("victoryAnimation"),
  confettiContainer: document.getElementById("confettiContainer"),
  scoreBoard: document.getElementById("scoreBoard"),
  victoryNextRoundBtn: document.getElementById("victoryNextRoundBtn"),
  victoryHomeBtn: document.getElementById("victoryHomeBtn"),
  newRoundBtn: document.getElementById("newRoundBtn"),
};

function getDifficulty() {
  const btn = document.querySelector('.difficulty-btn.active');
  if (btn) return btn.dataset.value;
  const sel = document.getElementById('difficulty');
  return sel ? sel.value : 'easy';
}

function getMode() {
  const m = document.querySelector('.mode-btn.active');
  return m ? m.dataset.mode : 'offline';
}

let roleRevealIdx = 0;
let clueTurnIdx = 0;
let discussionInterval = null;

function randChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function initializeGame() {
  // Load selected packs from localStorage or use all packs
  const selectedPacksJSON = localStorage.getItem("selectedPacks");
  if (selectedPacksJSON) {
    const selectedPackNames = JSON.parse(selectedPacksJSON);
    state.combinedWordPool = [];
    const difficulty = getDifficulty();
    
    selectedPackNames.forEach(packName => {
      const words = WORDS[packName][difficulty];
      state.combinedWordPool.push(...words);
    });
  } else {
    // If no packs selected, use all packs
    buildAllWordPool();
  }
}

function buildAllWordPool() {
  state.combinedWordPool = [];
  const difficulty = getDifficulty();
  const packNames = Object.keys(WORDS);
  
  packNames.forEach(packName => {
    const words = WORDS[packName][difficulty];
    state.combinedWordPool.push(...words);
  });
}

function goToWordPacks() {
  window.location.href = "word-packs.html";
}

function updatePlayerInputs() {
  els.playerNames.innerHTML = "";
  const n = parseInt(els.playerCount.value, 10);
  
  // Update max imposters based on player count
  const maxImpostors = Math.max(1, n - 1);
  els.imposterCount.max = maxImpostors;
  if (parseInt(els.imposterCount.value, 10) > maxImpostors) {
    els.imposterCount.value = maxImpostors;
  }
  
  for (let i = 0; i < n; i++) {
    const input = document.createElement("input");
    input.placeholder = `Player ${i+1} name`;
    input.id = `playerName${i}`;
    // default player 1 to account username if present
    try {
      const cur = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
      if (i === 0 && cur) input.value = cur;
    } catch (e) {}
    els.playerNames.appendChild(input);
  }
}

function newGame(skipSetup = false) {
  console.log('newGame called with skipSetup:', skipSetup);
  // Initialize/refresh word pools from selected packs
  initializeGame();
  
  console.log('Word pool initialized, pool size:', state.combinedWordPool.length);

  // Show battle pass widget for logged-in users (always show, update if user exists)
  const bpWidget = document.getElementById('battlePassWidget');
  if (bpWidget) {
    if (typeof getCurrentUser === 'function') {
      const user = getCurrentUser();
      if (user) {
        updateBattlePassWidget(user);
      } else {
        bpWidget.style.display = 'none';
      }
    }
  }

  // Determine player count: if skipping setup, reuse existing players
  let n;
  if (skipSetup && state.players && state.players.length) {
    n = state.players.length;
  } else {
    n = parseInt(els.playerCount.value, 10) || 6;
    // Clamp values to reasonable bounds
    n = Math.max(3, Math.min(10, n));
  }

  let imposterNum = parseInt(els.imposterCount.value, 10) || 1;
  imposterNum = Math.min(imposterNum, Math.max(1, n - 1));

  // Initialize scores on first full game (only when not skipping setup)
  if (!skipSetup && state.playerScores.length === 0) {
    state.playerScores = [];
    for (let i = 0; i < n; i++) {
      const raw = document.getElementById(`playerName${i}`) ? document.getElementById(`playerName${i}`).value.trim() : '';
      const currentUserName = (typeof getCurrentUser === 'function') ? getCurrentUser() : ((typeof account_getCurrent === 'function') ? account_getCurrent() : null);
      const name = raw || (i === 0 && currentUserName) || `Player ${i+1}`;
      state.playerScores.push({ id: i, name, score: 0 });
    }
    state.players = state.playerScores.map(p => ({ id: p.id, name: p.name }));
    state.roundNumber = 0;
  }

  // If players are already present (skipSetup) ensure state.players length matches n
  if (!state.players || state.players.length === 0) {
    state.players = state.playerScores.map(p => ({ id: p.id, name: p.name }));
  }

  state.roundNumber++;
  state.imposterIndices = [];
  let availableIndices = Array.from({length: state.players.length}, (_, i) => i);
  for (let i = 0; i < imposterNum; i++) {
    const randomIdx = Math.floor(Math.random() * availableIndices.length);
    state.imposterIndices.push(availableIndices[randomIdx]);
    availableIndices.splice(randomIdx, 1);
  }

  // Select word from combined pool
  const wordObj = randChoice(state.combinedWordPool);
  state.secretWord = wordObj.word;
  state.secretHint = wordObj.hint;
  state.votes = [];
  state.imposterCount = imposterNum;
  roleRevealIdx = 0;  // IMPORTANT: Reset to 0
  clueTurnIdx = 0;

  // If skipping setup (Next Round) hide vote/summary sections and jump straight to role reveal
  if (skipSetup) {
    // clear any previous vote UI
    if (els.voteOptions) els.voteOptions.innerHTML = "";
    if (els.vote) els.vote.hidden = true;
    if (els.voteResult) els.voteResult.textContent = "";
    if (els.discussion) els.discussion.hidden = true;

    // Restore sidebar visibility when starting next round
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.style.display = '';
      sidebar.classList.remove('collapsed');
    }

    els.setup.hidden = true;
    els.role.hidden = false;
    revealRole();
  } else {
    els.setup.hidden = true;
    els.role.hidden = false;
    revealRole();
  }
}

function revealRole() {
  const isImposter = state.imposterIndices.includes(roleRevealIdx);

  // Ensure roleCard HTML exists (in case it was removed in a previous round)
  let roleCard = document.getElementById('roleCard');
  if (!roleCard) {
    const roleSection = document.getElementById('role');
    if (roleSection) {
      // Create the missing card HTML
      const cardHTML = `<div class="flip-card" id="roleCard">
        <div class="flip-card-inner">
          <div class="flip-card-front" id="roleCardFront">
            <div class="card-label">Hover to reveal</div>
            <div class="card-content"></div>
            <div class="card-username" id="roleCardFrontName">Player</div>
          </div>
          <div class="flip-card-back" id="roleCardBack">
            <div class="back-name" id="roleCardBackName"></div>
            <div class="back-role" id="roleCardBackRole"></div>
            <div class="back-word" id="roleCardBackWord"></div>
            <div class="back-hint" id="roleCardBackHint"></div>
          </div>
        </div>
      </div>`;
      
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cardHTML;
      roleSection.insertBefore(tempDiv.firstChild, roleSection.firstChild);
      roleCard = document.getElementById('roleCard');
    }
  }

  // Update flip card front/back
  const frontName = document.getElementById('roleCardFrontName');
  const backName = document.getElementById('roleCardBackName');
  const backRole = document.getElementById('roleCardBackRole');
  const backWord = document.getElementById('roleCardBackWord');
  const backHint = document.getElementById('roleCardBackHint');

  const player = state.players[roleRevealIdx] || { name: `Player ${roleRevealIdx+1}` };
  // show name on front (non-sensitive)
  if (frontName) frontName.textContent = player.name;
  if (backName) backName.textContent = player.name;
  if (backRole) backRole.textContent = isImposter ? 'IMPOSTER' : 'CIVILIAN';

  // Civilians see the secret word; imposters see the hint only
  if (backWord) {
    if (!isImposter) {
      backWord.textContent = `Word: ${state.secretWord}`;
      backWord.style.display = '';
    } else {
      backWord.textContent = '';
      backWord.style.display = 'none';
    }
  }
  if (backHint) {
    if (isImposter) {
      backHint.textContent = `Hint: ${state.secretHint}`;
      backHint.style.display = '';
    } else {
      backHint.textContent = '';
      backHint.style.display = 'none';
    }
  }

  // Reset card flip state and add unrevealed glow class
  roleCard = document.getElementById('roleCard');
  const roleCardInner = roleCard ? roleCard.querySelector('.flip-card-inner') : null;
  if (roleCardInner) {
    // Clear inline transform to allow CSS hover to work
    roleCardInner.style.transform = '';
    roleCardInner.style.removeProperty('transform');
  }
  if (roleCard) {
    roleCard.classList.add('unrevealed');
    // Remove old event listeners by cloning and replacing to avoid duplicates
    const newRoleCard = roleCard.cloneNode(true);
    roleCard.parentNode.replaceChild(newRoleCard, roleCard);
    const newCard = document.getElementById('roleCard');
    // add fresh listeners to the cloned card
    const clearUnrevealed = () => { newCard.classList.remove('unrevealed'); };
    newCard.addEventListener('mouseenter', clearUnrevealed, { once: true });
    newCard.addEventListener('touchstart', clearUnrevealed, { once: true });
  }

  // Hide player name header (only show role on the card when revealed)
  const roleHeader = document.getElementById('rolePlayerName');
  if (roleHeader) roleHeader.textContent = '';
}

function nextRole() {
  roleRevealIdx++;
  if (roleRevealIdx >= state.players.length) {
    // All roles shown — move to the group discussion timer instead of per-player clues
    // hide role area and remove card markup so cards don't remain in DOM
    if (els.role) {
      const roleCard = document.getElementById('roleCard');
      if (roleCard && roleCard.parentNode) roleCard.parentNode.removeChild(roleCard);
      els.role.hidden = true;
    }
    // Hide legacy clues section if present
    if (els.clues) els.clues.hidden = true;
    // Hide sidebar during gameplay
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.style.display = 'none';
    // Show discussion UI fullscreen and start countdown
    if (els.discussion) {
      // clear any leftover card content
      const rc = document.getElementById('roleCard'); if (rc && rc.parentNode) rc.parentNode.removeChild(rc);
      els.discussion.hidden = false;
      // read duration (seconds) from setup, default to 120
      const raw = els.discussionDuration && els.discussionDuration.value ? parseInt(els.discussionDuration.value, 10) : 120;
      const duration = Math.max(5, isNaN(raw) ? 120 : raw);
      startDiscussionTimer(duration);
    } else {
      // fallback: go straight to voting
      els.clues.hidden = false;
      els.currentPlayerName.textContent = state.players[clueTurnIdx].name;
    }
  } else {
    revealRole();
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function startDiscussionTimer(durationSeconds) {
  // clear any existing interval
  if (discussionInterval) {
    clearInterval(discussionInterval);
    discussionInterval = null;
  }

  let remaining = durationSeconds;
  if (els.discussionTimer) els.discussionTimer.textContent = formatTime(remaining);

  discussionInterval = setInterval(() => {
    remaining -= 1;
    if (els.discussionTimer) els.discussionTimer.textContent = formatTime(remaining);
    if (remaining <= 0) {
      clearInterval(discussionInterval);
      discussionInterval = null;
      // Hide discussion UI and proceed to voting
      if (els.discussion) els.discussion.hidden = true;
      toVoting();
    }
  }, 1000);

  // wire skip button
  if (els.skipDiscussionBtn) {
    els.skipDiscussionBtn.onclick = () => {
      if (discussionInterval) { clearInterval(discussionInterval); discussionInterval = null; }
      if (els.discussion) els.discussion.hidden = true;
      toVoting();
    };
  }
}

function nextClue() {
  clueTurnIdx++;
  if (clueTurnIdx >= state.players.length) {
    if (els.nextClueBtn) els.nextClueBtn.disabled = true;
    if (els.toVoteBtn) els.toVoteBtn.hidden = false;
  } else {
    els.currentPlayerName.textContent = state.players[clueTurnIdx].name;
  }
}

function toVoting() {
  // Stop discussion timer if running
  if (discussionInterval) { clearInterval(discussionInterval); discussionInterval = null; }

  if (els.clues) els.clues.hidden = true;
  els.vote.hidden = false;
  els.voteOptions.innerHTML = "";
  state.votes = [];
  state.voteIdx = 0;
  state.voteTally = new Array(state.players.length).fill(0);
  
  showVoteScreen();
}

function showVoteScreen() {
  els.voteOptions.innerHTML = "";
  
  if (state.voteIdx >= state.players.length) {
    // Voting complete, show results
    finishVote();
    return;
  }
  
  const currentVoter = state.players[state.voteIdx];
  
  // Create title for current voter
  const title = document.createElement("h3");
  title.textContent = `${currentVoter.name}, who do you vote to remove?`;
  els.voteOptions.appendChild(title);
  
  // Create buttons for each player
  state.players.forEach((target, idx) => {
    const btn = document.createElement("button");
    btn.textContent = target.name;
    btn.className = "vote-button";
    btn.onclick = () => castVote(idx);
    els.voteOptions.appendChild(btn);
  });
}

function castVote(targetIdx) {
  // client-side throttle to avoid rapid automated voting
  if (!allowAction('vote', 3, 1000)) {
    window.addDebug && window.addDebug('castVote throttled');
    return;
  }

  state.votes.push({
    voter: state.players[state.voteIdx].name,
    target: state.players[targetIdx].name,
    targetIdx: targetIdx
  });
  
  state.voteTally[targetIdx]++;
  state.voteIdx++;
  
  showVoteScreen();
}

function finishVote() {
  els.voteOptions.innerHTML = "";
  
  const accused = state.voteTally.indexOf(Math.max(...state.voteTally));
  const correct = state.imposterIndices.includes(accused);
  
  // Determine if all imposters are caught
  let allImpostersCaught = true;
  const allAccused = new Set();
  state.votes.forEach(vote => {
    allAccused.add(vote.targetIdx);
  });
  state.imposterIndices.forEach(idx => {
    if (!allAccused.has(idx)) {
      allImpostersCaught = false;
    }
  });
  
  // Build vote summary
  const summary = document.createElement("div");
  summary.className = "vote-summary";
  
  const title = document.createElement("h3");
  title.textContent = "Vote Results";
  summary.appendChild(title);
  
  // Show individual votes
  const votesList = document.createElement("ul");
  state.votes.forEach(vote => {
    const li = document.createElement("li");
    li.textContent = `${vote.voter} voted for ${vote.target}`;
    votesList.appendChild(li);
  });
  summary.appendChild(votesList);
  
  // Show tally
  const tally = document.createElement("div");
  tally.className = "vote-tally";
  const tallyTitle = document.createElement("strong");
  tallyTitle.textContent = "Tally:";
  tally.appendChild(tallyTitle);
  
  state.players.forEach((p, idx) => {
    const tallyLine = document.createElement("p");
    tallyLine.textContent = `${p.name}: ${state.voteTally[idx]} vote${state.voteTally[idx] !== 1 ? 's' : ''}`;
    if (idx === accused) {
      tallyLine.className = "accused";
    }
    tally.appendChild(tallyLine);
  });
  summary.appendChild(tally);
  
  // Show result
  const result = document.createElement("p");
  let resultText = "";
  if (correct) {
    resultText = state.imposterCount > 1 
      ? `Imposter caught! ${allImpostersCaught ? "All imposters eliminated!" : "Some imposters remain..."}`
      : "Imposter caught! Civilians win.";
    result.className = "win";
  } else {
    resultText = "Wrong vote! Imposter wins.";
    result.className = "lose";
  }
  result.textContent = resultText;
  summary.appendChild(result);
  
  els.voteOptions.innerHTML = "";
  els.voteOptions.appendChild(summary);
  
  // Award points based on outcome
  awardPoints(accused, correct);

  // Award XP to accounts based on round outcome
  try { awardRoundXP(correct); } catch (e) { console.warn('awardRoundXP failed', e); }

  // Log game to history
  try {
    if (typeof logGame === 'function') {
      logGame({
        players: state.players.map(p => p.name),
        imposters: state.imposterIndices.map(idx => state.players[idx].name),
        word: state.secretWord,
        won: correct,
        imposterWon: !correct
      });
    }
  } catch (e) { console.warn('Failed to log game', e); }

  // Award XP and trigger victory animation
  awardGameXP(correct);

  // Trigger victory animation for civilians or imposters
  if (correct) {
    playCivVictoryAnimation();
  } else {
    playImposterVictoryAnimation();
  }
}

// Award XP to accounts: imposter win => imposters +10xp, civilian win => civilians +5xp
function awardRoundXP(imposterCaught) {
  // imposterCaught === true means civilians won
  const imposterXP = 10;
  const civilianXP = 5;

  if (imposterCaught) {
    // civilians win
    state.players.forEach((p, idx) => {
      if (!state.imposterIndices.includes(idx)) {
        // civilian
        if (window && typeof window.account_addXP === 'function') {
          window.account_addXP(p.name, civilianXP);
        }
      }
    });
  } else {
    // imposter(s) win
    state.imposterIndices.forEach(idx => {
      const p = state.players[idx];
      if (p && window && typeof window.account_addXP === 'function') {
        window.account_addXP(p.name, imposterXP);
      }
    });
  }
}

// Sync XP gains to logged-in account (if any). We map account username to player name.
function syncAccountXP(deltas) {
  const currentUser = localStorage.getItem('currentUser');
  if (!currentUser) return;
  const accountsJSON = localStorage.getItem('accounts');
  if (!accountsJSON) return;
  const accounts = JSON.parse(accountsJSON || '{}');
  const account = accounts[currentUser];
  if (!account) return;

  // find matching player index by name
  const playerIdx = state.playerScores.findIndex(p => p.name === currentUser);
  if (playerIdx === -1) return; // user did not use same name this round

  const xpGain = deltas[playerIdx] > 0 ? deltas[playerIdx] : 0;
  account.xp = (account.xp || 0) + xpGain;
  accounts[currentUser] = account;
  localStorage.setItem('accounts', JSON.stringify(accounts));
}
// Award points based on game outcome
function awardPoints(accusedIdx, imposterCaught) {
  // Count votes received by each player
  const votesReceived = new Array(state.players.length).fill(0);
  state.votes.forEach(vote => {
    votesReceived[vote.targetIdx]++;
  });
  
  if (imposterCaught) {
    // Imposters are voted out: all civilians get +2, other civilians get +1
    state.playerScores.forEach(scoreEntry => {
      if (!state.imposterIndices.includes(scoreEntry.id)) {
        // Civilian: +2 for catching imposter
        scoreEntry.score += 2;
      }
    });
    // All non-accused players get +1 for surviving
    state.playerScores.forEach(scoreEntry => {
      if (scoreEntry.id !== accusedIdx) {
        scoreEntry.score += 1;
      }
    });
  } else {
    // Imposters are NOT voted out: they get +3, +1 bonus if zero votes
    state.imposterIndices.forEach(imposterIdx => {
      const imposter = state.playerScores.find(p => p.id === imposterIdx);
      if (imposter) {
        imposter.score += 3;
        // Bonus: +1 if imposter received zero votes
        if (votesReceived[imposterIdx] === 0) {
          imposter.score += 1;
        }
      }
    });
  }
}

// Clear any existing victory overlay/confetti
function clearVictoryAnimation() {
  if (els.victoryAnimation) {
    els.victoryAnimation.setAttribute('hidden', '');
  }
  if (els.confettiContainer) {
    els.confettiContainer.innerHTML = "";
  }
  // remove any stray .confetti elements appended to body (legacy)
  document.querySelectorAll('.confetti').forEach(n => n.remove());
}

function _spawnConfetti(count, palette = []) {
  if (!els.confettiContainer) return;
  els.confettiContainer.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';

    const randomX = Math.random() * 100; // percent across viewport
    confetti.style.left = randomX + 'vw';
    confetti.style.top = '-10px';

    const delay = Math.random() * 0.5;
    const duration = 2.5 + Math.random() * 1.8;
    confetti.style.animationDelay = delay + 's';
    confetti.style.animationDuration = duration + 's';

    const size = 6 + Math.random() * 16;
    confetti.style.width = size + 'px';
    confetti.style.height = size + 'px';

    // color from palette
    const color = palette[Math.floor(Math.random() * palette.length)];
    confetti.style.background = color || '#00ff88';

    els.confettiContainer.appendChild(confetti);
  }
}

function playCivVictoryAnimation() {
  clearVictoryAnimation();
  els.victoryAnimation.removeAttribute('hidden');
  // set victory text
  const text = document.querySelector('.victory-text');
  if (text) text.textContent = '🎉 CIVILIANS WIN! 🎉';

  // Display scoreboard
  displayScoreboard();

  // green/blue/gold palette
  const palette = ['#00ff88', '#00b4ff', '#ffc800'];
  _spawnConfetti(60, palette);
}

function playImposterVictoryAnimation() {
  clearVictoryAnimation();
  els.victoryAnimation.removeAttribute('hidden');
  const text = document.querySelector('.victory-text');
  if (text) text.textContent = '💀 IMPOSTER WINS! 💀';

  // Display scoreboard
  displayScoreboard();

  // red/dark palette
  const palette = ['#ff4444', '#ff8a80', '#ffb74d'];
  _spawnConfetti(40, palette);

  // subtle pulsing red background for the overlay
  const overlay = document.querySelector('.victory-overlay');
  if (overlay) {
    overlay.style.background = 'rgba(180, 20, 20, 0.45)';
    setTimeout(() => { overlay.style.background = 'rgba(0,0,0,0.3)'; }, 1500);
  }
}

// Wire victory screen buttons
if (els.victoryNextRoundBtn) {
  els.victoryNextRoundBtn.addEventListener('click', () => {
    clearVictoryAnimation();
    // If offline mode, auto-refresh page to setup screen
    if (getMode() === 'offline') {
      window.location.href = 'play.html';
    } else {
      // Online mode: start next round while keeping scores and players
      newGame(true);
    }
  });
}

if (els.victoryHomeBtn) {
  els.victoryHomeBtn.addEventListener('click', () => {
    clearVictoryAnimation();
    goHome();
  });
}

function newRound() {
  // Completely reset game and return to setup
  state.playerScores = [];
  state.roundNumber = 0;
  roleRevealIdx = 0;
  clueTurnIdx = 0;
  if (els.vote) els.vote.hidden = true;
  if (els.role) els.role.hidden = true;
  if (els.discussion) els.discussion.hidden = true;
  clearVictoryAnimation();
  if (els.nextClueBtn) els.nextClueBtn.disabled = false;
  if (els.toVoteBtn) els.toVoteBtn.hidden = true;
  if (els.voteResult) els.voteResult.textContent = "";
  if (els.setup) els.setup.hidden = false;
  // Show sidebar again
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.style.display = '';
    sidebar.classList.remove('collapsed');
  }
  updatePlayerInputs();
}

// Award XP based on game outcome
function awardGameXP(civiliansWon) {
  if (typeof BattlePass === 'undefined') return; // Battle Pass not loaded

  // Check if player is host (imposter or civilian)
  const playerIndex = state.players.findIndex(p => p.id === state.playerScores[0]?.id);
  if (playerIndex === -1) return;

  const isImposter = state.imposterIndices.includes(playerIndex);

  // Award XP based on role and outcome
  if (civiliansWon) {
    if (!isImposter) {
      // Civilian won
      BattlePass.awardXPForEvent('WIN_CIVILIAN');
    } else {
      // Imposter lost - small consolation XP
      BattlePass.awardXPForEvent('PARTICIPATE_GAME');
    }
  } else {
    if (isImposter) {
      // Imposter won
      BattlePass.awardXPForEvent('WIN_IMPOSTER');
    } else {
      // Civilian lost - small consolation XP
      BattlePass.awardXPForEvent('PARTICIPATE_GAME');
    }
  }
}

// Display current scores on victory screen
function displayScoreboard() {
  if (!els.scoreBoard) return;
  els.scoreBoard.innerHTML = "";
  
  const title = document.createElement("div");
  title.style.cssText = "font-weight: bold; margin-bottom: 10px; color: #4ac9ff; text-align: center;";
  title.textContent = `Round ${state.roundNumber} Scores`;
  els.scoreBoard.appendChild(title);
  
  // Sort by score (descending)
  const sorted = [...state.playerScores].sort((a, b) => b.score - a.score);
  
  sorted.forEach(scoreEntry => {
    const entry = document.createElement("div");
    entry.className = "score-entry";
    
    const nameSpan = document.createElement("span");
    nameSpan.className = "player-name";
    nameSpan.textContent = scoreEntry.name;
    
    const pointsSpan = document.createElement("span");
    pointsSpan.className = "player-points";
    pointsSpan.textContent = `${scoreEntry.score} pts`;
    
    entry.appendChild(nameSpan);
    entry.appendChild(pointsSpan);
    els.scoreBoard.appendChild(entry);
  });
}

function goHome() {
  // Reset scores and go back to setup
  state.playerScores = [];
  state.roundNumber = 0;
  roleRevealIdx = 0;
  clueTurnIdx = 0;
  if (els.vote) els.vote.hidden = true;
  if (els.role) els.role.hidden = true;
  if (els.discussion) els.discussion.hidden = true;
  clearVictoryAnimation();
  if (els.nextClueBtn) els.nextClueBtn.disabled = false;
  if (els.toVoteBtn) els.toVoteBtn.hidden = true;
  if (els.voteResult) els.voteResult.textContent = "";
  if (els.setup) els.setup.hidden = false;
  // Show sidebar again after game ends
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.style.display = '';
    sidebar.classList.remove('collapsed');
  }
  updatePlayerInputs();
}


// Event listeners (guarded)
if (els.wordPacksBtn) els.wordPacksBtn.addEventListener("click", goToWordPacks);
if (els.playerCount) els.playerCount.addEventListener("change", updatePlayerInputs);
if (els.startBtn) els.startBtn.addEventListener("click", async (e) => {
  e && e.preventDefault && e.preventDefault();
  console.log('Start button clicked');
  if (window.addDebug) window.addDebug('STARTBTN clicked');
  const mode = getMode();
  if (window.addDebug) window.addDebug('Mode: ' + mode);
  if (mode === 'online') {
    const currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;

    const action = prompt('Create new lobby or join existing?\n(Type "create" or paste room code to join)', 'create');

    if (!action) return;

    // Creating a room (host) requires login
    if (action === 'create') {
      if (!currentUser) {
        alert('You must be logged in to host a game. Please log in or create an account.');
        return;
      }

      await OnlineGame.init(currentUser);

      // Get a random word from the combined pool for this session
      const wordObj = state.combinedWordPool && state.combinedWordPool.length > 0
        ? state.combinedWordPool[Math.floor(Math.random() * state.combinedWordPool.length)]
        : { word: 'PLACEHOLDER', hint: '' };

      const gameConfig = {
        playerCount: parseInt(document.getElementById('playerCount').value, 10),
        imposterCount: parseInt(document.getElementById('imposterCount').value, 10),
        difficulty: getDifficulty(),
        discussionDuration: parseInt(document.getElementById('discussionDuration').value, 10),
        word: wordObj.word,
        hint: wordObj.hint
      };

      const result = OnlineGame.createRoom(gameConfig);
      if (result.success) {
        alert(`Room code: ${result.roomCode}\nShare this with friends!`);
      }

    } else {
      // Join existing room -> allow guest username if not logged in
      let joinName = currentUser;
      if (!joinName) {
        joinName = prompt('Enter a display name for this game (temporary):', 'Guest' + Math.floor(Math.random() * 9000 + 1000));
        if (!joinName) return;
      }

      await OnlineGame.init(joinName);
      const result = OnlineGame.joinRoom(action);
      if (!result.success) {
        alert(`Failed to join: ${result.error}`);
      }
    }
  } else {
    state.isOnline = false;
    newGame(false);
  }
});
if (els.nextRoleBtn) els.nextRoleBtn.addEventListener("click", nextRole);
if (els.nextClueBtn) els.nextClueBtn.addEventListener("click", nextClue);
if (els.toVoteBtn) els.toVoteBtn.addEventListener("click", toVoting);
if (els.newRoundBtn) els.newRoundBtn.addEventListener("click", newRound);

// Initialize
// wire difficulty/mode buttons and sidebar toggle
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.difficulty-btn').forEach(b => b.addEventListener('click', (ev) => {
    document.querySelectorAll('.difficulty-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
  }));
  document.querySelectorAll('.mode-btn').forEach(b => b.addEventListener('click', (ev) => {
    document.querySelectorAll('.mode-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
  }));

  // optional local sidebar toggle, keep in sync with account.js
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    try { if (localStorage.getItem('sidebarCollapsed') === '1') sidebar.classList.add('collapsed'); } catch (e) {}
  }
  if (sidebarToggle && sidebar) sidebarToggle.addEventListener('click', () => { sidebar.classList.toggle('collapsed'); try{ localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed') ? '1' : '0'); } catch (e) {} });

  // ensure player inputs and defaults are up-to-date
  updatePlayerInputs();

  // Initialize battle pass modal and toggle button
  const bpModal = document.getElementById('battlePassModal');
  const bpToggleBtn = document.getElementById('bpToggleBtn');
  const bpCloseBtn = document.getElementById('closeBpBtn');
  
  if (typeof getCurrentUser === 'function') {
    const user = getCurrentUser();
    if (user) {
      if (bpToggleBtn) bpToggleBtn.removeAttribute('hidden');
      updateBattlePassWidget(user);
    }
  }
  
  // Battle pass toggle button click
  if (bpToggleBtn && bpModal) {
    bpToggleBtn.addEventListener('click', () => {
      // Use style-based show to be consistent with `battle-pass.js`
      try { bpModal.style.display = 'flex'; } catch (e) { bpModal.removeAttribute('hidden'); }
    });
  }
  
  // Battle pass close button click
  if (bpCloseBtn && bpModal) {
    bpCloseBtn.addEventListener('click', () => {
      try { bpModal.style.display = 'none'; } catch (e) { bpModal.setAttribute('hidden', ''); }
    });
  }
  
  // Close modal when clicking outside
  if (bpModal) {
    bpModal.addEventListener('click', (e) => {
      if (e.target === bpModal) {
        bpModal.setAttribute('hidden', '');
      }
    });
  }
});

// Battle Pass Widget Update Function
function updateBattlePassWidget(username) {
  if (typeof getAccount !== 'function' || typeof getBattlePassProgress !== 'function') return;
  
  const acc = getAccount(username);
  if (!acc) return;
  
  const progress = getBattlePassProgress(acc.xp || 0);
  const tierData = BATTLEPASS_TIERS[progress.currentTier - 1] || BATTLEPASS_TIERS[0];
  
  const tierEl = document.getElementById('bpTier');
  const progressBar = document.getElementById('bpProgressBar');
  const xpEl = document.getElementById('bpXP');
  
  if (tierEl) tierEl.textContent = progress.currentTier;
  if (progressBar) progressBar.style.width = progress.progress + '%';
  if (xpEl) {
    const currentTierXP = tierData.requiredXP;
    const nextTierXP = BATTLEPASS_TIERS[Math.min(progress.currentTier, BATTLEPASS_TIERS.length - 1)].requiredXP;
    const xpInTier = acc.xp - currentTierXP;
    const xpNeeded = nextTierXP - currentTierXP;
    xpEl.textContent = xpInTier + ' / ' + xpNeeded + ' XP';
  }

  // Populate tier strip with sample tiers (show current tier and next 4)
  const bpStrip = document.getElementById('bpStrip');
  if (bpStrip) {
    bpStrip.innerHTML = '';
    const startTier = Math.max(1, progress.currentTier);
    const endTier = Math.min(startTier + 4, BATTLEPASS_TIERS.length);
    
    for (let i = startTier; i <= endTier; i++) {
      const tierCard = document.createElement('div');
      tierCard.className = 'bp-tier';
      if (i === progress.currentTier) tierCard.style.borderColor = '#00ffff';
      
      const icon = document.createElement('div');
      icon.className = 'bp-tier-icon';
      icon.textContent = i % 5 === 0 ? '⭐' : '🎯';
      
      const num = document.createElement('div');
      num.className = 'bp-tier-number';
      num.textContent = 'T' + i;
      
      tierCard.appendChild(icon);
      tierCard.appendChild(num);
      bpStrip.appendChild(tierCard);
    }
  }
}