// localStorage-backed account system with password encryption
function _loadAccounts() {
  try { return JSON.parse(localStorage.getItem('accounts') || '{}'); } catch (e) { return {}; }
}
function _saveAccounts(a) { localStorage.setItem('accounts', JSON.stringify(a)); }

// Initialize default admin account on first load
async function initAdminAccount() {
  const accounts = _loadAccounts();
  if (accounts['MoonbreonGX']) return; // already exists
  
  const adminPassword = 'SigmaLithium';
  const encryptedPassword = await CryptoUtil.encryptPassword(adminPassword);
  if (!encryptedPassword) return;
  
  accounts['MoonbreonGX'] = {
    password: encryptedPassword,
    email: 'rooksacrifice@gmail.com',
    xp: 0,
    coins: 0,
    skins: [],
    created: Date.now(),
    sessionToken: CryptoUtil.generateToken(),
    isAdmin: true
  };
  _saveAccounts(accounts);
  console.log('Admin account initialized');
}

// Initialize admin on load
initAdminAccount().catch(e => console.warn('Failed to init admin account:', e));

async function createAccount(username, password, email = '') {
  if (!username || !password || !email) return { ok:false, msg:'Username, password and email required' };
  if (password.length < 6) return { ok:false, msg:'Password must be at least 6 characters' };
  // basic email format check
  const emailRe = /^\S+@\S+\.\S+$/;
  if (!emailRe.test(email)) return { ok:false, msg:'Invalid email address' };
  
  const accounts = _loadAccounts();
  if (accounts[username]) return { ok:false, msg:'Username already exists' };
  // ensure email not reused
  const used = Object.values(accounts).find(a => a.email && a.email.toLowerCase() === email.toLowerCase());
  if (used) return { ok:false, msg:'Email already in use' };
  
  // Encrypt password using Web Crypto API
  const encryptedPassword = await CryptoUtil.encryptPassword(password);
  if (!encryptedPassword) return { ok:false, msg:'Encryption failed' };
  
  accounts[username] = { 
    password: encryptedPassword,
    email: email || '',
    xp: 0,
    coins: 0,
    skins: [],
    created: Date.now(),
    sessionToken: CryptoUtil.generateToken()
  };
  _saveAccounts(accounts);
  return { ok:true };
}

async function loginAccount(username, password) {
  const accounts = _loadAccounts();
  const acc = accounts[username];
  if (!acc) return { ok:false, msg:'No such user' };
  
  // Verify encrypted password
  const isValid = await CryptoUtil.verifyPassword(password, acc.password);
  if (!isValid) return { ok:false, msg:'Invalid password' };
  
  // Generate new session token on login
  acc.sessionToken = CryptoUtil.generateToken();
  _saveAccounts(accounts);
  
  localStorage.setItem('currentUser', username);
  localStorage.setItem('sessionToken', acc.sessionToken);
  // Mark admin flag in localStorage if applicable
  if (acc.isAdmin) {
    localStorage.setItem('isAdmin', '1');
  } else {
    localStorage.removeItem('isAdmin');
  }
  return { ok:true };
}

function logout() { 
  localStorage.removeItem('currentUser');
  localStorage.removeItem('sessionToken');
  localStorage.removeItem('isAdmin');
}

function getCurrentUser() {
  return localStorage.getItem('currentUser');
}

function getAccount(username) { const a=_loadAccounts(); return a[username]; }

// Admin helper: remove all accounts (available via console)
function adminDeleteAllAccounts() {
  localStorage.removeItem('accounts');
  localStorage.removeItem('gameHistory');
  // also clear friends stored per user
  Object.keys(localStorage).forEach(k => { if (k.startsWith('friends_') || k.startsWith('invitations_')) localStorage.removeItem(k); });
  alert('All accounts and game history removed from local storage');
}
window.adminDeleteAllAccounts = adminDeleteAllAccounts;

// Add XP to a specific account (creates account entry if missing)
function account_addXP(username, amount) {
  if (!username || !amount) return false;
  const accounts = _loadAccounts();
  if (!accounts[username]) return false;
  const oldXp = accounts[username].xp || 0;
  const add = Number(amount || 0);
  const newXp = oldXp + add;
  accounts[username].xp = newXp;

  // Award coins for every 50 XP threshold crossed (10 coins per 50 XP)
  const oldThreshold = Math.floor(oldXp / 50);
  const newThreshold = Math.floor(newXp / 50);
  const thresholdsCrossed = Math.max(0, newThreshold - oldThreshold);
  if (thresholdsCrossed > 0) {
    accounts[username].coins = (accounts[username].coins || 0) + (thresholdsCrossed * 10);
  }

  _saveAccounts(accounts);
  // if this user is currently logged in, refresh UI
  if (getCurrentUser() === username) {
    // trigger UI update on account page or play page
    setTimeout(account_refreshAllDisplays, 50);
  }
  return true;
}

function account_getLevelFromXP(xp) {
  const level = Math.floor((xp || 0) / 100);
  const progress = (xp || 0) % 100;
  return { level, progress };
}

// UI wiring
document.addEventListener('DOMContentLoaded', () => {
  console.log('Account.js DOMContentLoaded fired');
  console.log('CryptoUtil available?', typeof CryptoUtil);
  if (window.addDebug) window.addDebug('Account.js loaded, CryptoUtil=' + typeof CryptoUtil);
  
  const createBtn = document.getElementById('createAccountBtn');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const acctUsername = document.getElementById('acctUsername');
  const acctPassword = document.getElementById('acctPassword');
  const loggedInArea = document.getElementById('loggedInArea');
  const authForms = document.getElementById('authForms');
  const acctName = document.getElementById('acctName');
  const acctXP = document.getElementById('acctXP');
  const confirmPasswordRow = document.getElementById('confirmPasswordRow');

  console.log('Elements found:', { createBtn, loginBtn, logoutBtn, acctUsername, acctPassword });
  if (window.addDebug) window.addDebug('Elements: createBtn=' + !!createBtn + ' loginBtn=' + !!loginBtn);

  // Hide confirm password by default (only show for account creation)
  if (confirmPasswordRow) confirmPasswordRow.style.display = 'none';

  // Toggle confirm password visibility based on which button user focuses
  if (createBtn && confirmPasswordRow) {
    createBtn.addEventListener('focus', () => { confirmPasswordRow.style.display = ''; });
  }
  if (loginBtn && confirmPasswordRow) {
    loginBtn.addEventListener('focus', () => { confirmPasswordRow.style.display = 'none'; });
  }

  function refreshUI() {
    const user = getCurrentUser();
    if (user) {
      if (authForms) authForms.hidden = true;
      if (loggedInArea) loggedInArea.hidden = false;
      if (acctName) acctName.textContent = user;
      const acc = getAccount(user) || { xp: 0 };
      if (acctXP) acctXP.textContent = acc.xp || 0;
      const lvl = account_getLevelFromXP(acc.xp || 0);
      const acctLevel = document.getElementById('acctLevel');
      const acctXPBar = document.getElementById('acctXPBar');
      if (acctLevel) acctLevel.textContent = lvl.level;
      if (acctXPBar) acctXPBar.style.width = Math.min(100, Math.max(0, lvl.progress)) + '%';

      // Display player stats
      const stats = calculatePlayerStats(user);
      const gamesPlayedEl = document.getElementById('statGamesPlayed');
      const winRateEl = document.getElementById('statWinRate');
      const civilianWinsEl = document.getElementById('statCivilianWins');
      const imposterWinsEl = document.getElementById('statImposterWins');
      if (gamesPlayedEl) gamesPlayedEl.textContent = stats.gamesPlayed;
      if (winRateEl) winRateEl.textContent = stats.winRate + '%';
      if (civilianWinsEl) civilianWinsEl.textContent = stats.civilianWins;
      if (imposterWinsEl) imposterWinsEl.textContent = stats.imposterWins;

      // Display recent games
      renderRecentGames(user);
      // Show admin sidebar link only to admin accounts
      try {
        const sidebarAdmin = document.getElementById('sidebarAdminLink');
        const accObj = getAccount(user) || {};
        const isAdminFlag = accObj.isAdmin || (localStorage.getItem('isAdmin') === '1');
        if (sidebarAdmin) sidebarAdmin.style.display = isAdminFlag ? '' : 'none';
      } catch (e) {}
    } else {
      if (authForms) authForms.hidden = false;
      if (loggedInArea) loggedInArea.hidden = true;
    }
  }

  function renderRecentGames(username) {
    const recentGamesEl = document.getElementById('recentGamesList');
    if (!recentGamesEl) return;
    recentGamesEl.innerHTML = '';
    
    const games = getRecentGames(5);
    if (!games || games.length === 0) {
      recentGamesEl.innerHTML = '<div class="small" style="color:#9fdcff;">No games played yet.</div>';
      return;
    }

    // Filter to only games this user played in
    const userGames = games.filter(g => g.players && g.players.includes(username));
    if (userGames.length === 0) {
      recentGamesEl.innerHTML = '<div class="small" style="color:#9fdcff;">No games played yet.</div>';
      return;
    }

    userGames.forEach(game => {
      const gameDiv = document.createElement('div');
      gameDiv.style.cssText = 'background:rgba(0,180,255,0.08); padding:10px; border-radius:6px; margin-bottom:8px; border-left:3px solid #4ac9ff;';
      
      const wasImposter = game.imposters && game.imposters.includes(username);
      const won = (game.won && !wasImposter) || (!game.won && wasImposter);
      const resultText = won ? '✓ Won' : '✗ Lost';
      const resultColor = won ? '#00ff88' : '#ff6b6b';
      
      const timeAgo = formatTimeAgo(game.timestamp);
      const role = wasImposter ? 'Imposter' : 'Civilian';
      const winner = game.won ? 'Civilians' : 'Imposters';
      
      gameDiv.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <div style="color:${resultColor}; font-weight:bold;">${resultText} (${role})</div>
          <div style="color:#9fdcff; font-size:0.8em;">${timeAgo}</div>
        </div>
        <div style="color:#9fdcff; font-size:0.85em;">Word: <strong>${game.word}</strong> • ${winner} won</div>
      `;
      recentGamesEl.appendChild(gameDiv);
    });
  }

  function formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  if (createBtn) createBtn.addEventListener('click', async () => {
      if (window.addDebug) window.addDebug('Create Account clicked');
    const u = acctUsername.value && acctUsername.value.trim();
    const e = (document.getElementById('acctEmail') && document.getElementById('acctEmail').value && document.getElementById('acctEmail').value.trim()) || '';
    const p = acctPassword.value && acctPassword.value.trim();
    const confirmPasswordInput = document.getElementById('acctPasswordConfirm');
    const pc = confirmPasswordInput && confirmPasswordInput.value && confirmPasswordInput.value.trim();
      if (window.addDebug) window.addDebug('Username=' + u + ' Email=' + e + ' Pass=' + (p ? 'YES' : 'NO'));
    
    if (!u || !p) return alert('Username and password required');
    if (p !== pc) return alert('Passwords do not match');
    
    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';
    try {
      const res = await createAccount(u, p, e);
      if (!res.ok) { 
        alert(res.msg); 
      } else { 
        alert('Account created — now log in'); 
        acctUsername.value = ''; 
        acctPassword.value = ''; 
        confirmPasswordInput.value = ''; 
        document.getElementById('acctEmail').value = ''; 
      }
    } catch (err) {
      console.error('Create account error:', err);
      alert('Error creating account: ' + err.message);
    }
    createBtn.disabled = false;
    createBtn.textContent = 'Create Account';
    refreshUI();
  });

  if (loginBtn) loginBtn.addEventListener('click', async () => {
    if (window.addDebug) window.addDebug('Login clicked');
    const u = acctUsername && acctUsername.value && acctUsername.value.trim();
    const p = acctPassword && acctPassword.value && acctPassword.value.trim();
    if (window.addDebug) window.addDebug('Username=' + u + ' Pass=' + (p ? 'YES' : 'NO'));
    if (!u || !p) return alert('Username and password required');
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    try {
      const res = await loginAccount(u, p);
      if (!res.ok) { 
        alert(res.msg); 
      } else { 
        alert('Logged in'); 
        acctPassword.value = ''; 
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('Error logging in: ' + err.message);
    }
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
    refreshUI();
  });

  if (logoutBtn) logoutBtn.addEventListener('click', () => { logout(); refreshUI(); alert('Logged out'); });

  refreshUI();
});

// Friends management and reset stats wiring
document.addEventListener('DOMContentLoaded', () => {
  const friendAddBtn = document.getElementById('friendAddBtn');
  const friendAddInput = document.getElementById('friendAddInput');
  const friendsListEl = document.getElementById('friendsList');
  const resetStatsBtn = document.getElementById('resetStatsBtn');

  function getFriendsFor(user) {
    if (!user) return [];
    try { return JSON.parse(localStorage.getItem(`friends_${user}`) || '[]'); } catch (e) { return []; }
  }

  function saveFriendsFor(user, arr) {
    if (!user) return; localStorage.setItem(`friends_${user}`, JSON.stringify(arr || []));
  }

  function renderFriends() {
    const cur = getCurrentUser();
    if (!friendsListEl) return;
    friendsListEl.innerHTML = '';
    if (!cur) { friendsListEl.innerHTML = '<div class="small">Log in to manage friends.</div>'; return; }
    const arr = getFriendsFor(cur);
    if (!arr || arr.length === 0) { friendsListEl.innerHTML = '<div class="small">No friends added yet.</div>'; return; }
    arr.forEach(name => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.03);';
      const left = document.createElement('div'); left.textContent = name;
      const btn = document.createElement('button'); btn.textContent = 'Remove'; btn.style.marginLeft = '8px';
      btn.addEventListener('click', () => { const newA = getFriendsFor(cur).filter(x => x !== name); saveFriendsFor(cur, newA); renderFriends(); });
      row.appendChild(left); row.appendChild(btn);
      friendsListEl.appendChild(row);
    });
  }

  if (friendAddBtn && friendAddInput) friendAddBtn.addEventListener('click', () => {
    const name = friendAddInput.value && friendAddInput.value.trim();
    const cur = getCurrentUser();
    if (!cur) return alert('Log in first to add friends');
    if (!name) return alert('Enter a username');
    if (name === cur) return alert('You cannot add yourself');
    const accounts = _loadAccounts();
    if (!accounts[name]) return alert('No such user');
    const arr = getFriendsFor(cur);
    if (arr.includes(name)) return alert('Already friends');
    arr.push(name); saveFriendsFor(cur, arr); friendAddInput.value = ''; renderFriends(); alert('Friend added');
  });

  if (resetStatsBtn) resetStatsBtn.addEventListener('click', () => {
    const cur = getCurrentUser();
    if (!cur) return alert('Log in first');
    const modal = document.getElementById('resetStatsModal');
    if (!modal) return alert('Modal not found');
    modal.hidden = false;
    modal.style.display = 'flex';
  });

  const resetStatsConfirmBtn = document.getElementById('resetStatsConfirmBtn');
  const resetStatsCancelBtn = document.getElementById('resetStatsCancelBtn');
  const resetStatsModal = document.getElementById('resetStatsModal');

  if (resetStatsConfirmBtn) resetStatsConfirmBtn.addEventListener('click', () => {
    const cur = getCurrentUser();
    if (!cur) return;
    const accounts = _loadAccounts();
    if (!accounts[cur]) return;
    accounts[cur].xp = 0;
    accounts[cur].coins = 0;
    _saveAccounts(accounts);
    account_refreshAllDisplays();
    if (resetStatsModal) {
      resetStatsModal.hidden = true;
      resetStatsModal.style.display = 'none';
    }
    alert('Stats reset');
  });

  if (resetStatsCancelBtn) resetStatsCancelBtn.addEventListener('click', () => {
    if (resetStatsModal) {
      resetStatsModal.hidden = true;
      resetStatsModal.style.display = 'none';
    }
  });

  renderFriends();
});

// Utility for other pages to update display
function account_getCurrent() { return getCurrentUser(); }
function account_refreshAllDisplays() {
  // try to update any account info placeholders on other pages
  const info = document.getElementById('playerAccountInfo');
  if (info) {
    info.innerHTML = '';
  }
  // Also update a global top-right player info area if present
  const top = document.getElementById('topRightInfo');
  if (top) {
    const u2 = getCurrentUser();
    if (!u2) { top.innerHTML = ''; }
    else {
      const a = getAccount(u2) || { xp:0, coins:0 };
      const lvl2 = account_getLevelFromXP(a.xp || 0);
      top.innerHTML = `<div style="display:flex;align-items:center;gap:10px;">
        <div style="text-align:right; font-size:0.9em; color:#9fdcff;">
          <div style="font-weight:700; color:#4ac9ff;">${u2}</div>
          <div style="font-size:0.85em;">Lv ${lvl2.level}</div>
          <div style="font-size:0.85em; color:#ffd700;">XP: <strong>${a.xp||0}</strong></div>
        </div>
      </div>`;
    }
    // Ensure admin sidebar visibility for other pages
    try {
      const cur = getCurrentUser();
      const sidebarAdmin = document.getElementById('sidebarAdminLink');
      const accObj = cur ? getAccount(cur) : null;
      const isAdminFlag = accObj && (accObj.isAdmin || (localStorage.getItem('isAdmin') === '1'));
      if (sidebarAdmin) sidebarAdmin.style.display = isAdminFlag ? '' : 'none';
    } catch (e) {}
  }
}

// Run once to populate if included on other pages
if (typeof window !== 'undefined') {
  window.addEventListener('load', account_refreshAllDisplays);
}

// Game history logging
function logGame(gameData) {
  try {
    const games = JSON.parse(localStorage.getItem('gameHistory') || '[]');
    const entry = {
      timestamp: Date.now(),
      players: gameData.players || [],
      imposters: gameData.imposters || [],
      word: gameData.word,
      won: gameData.won,
      imposterWon: gameData.imposterWon
    };
    games.push(entry);
    if (games.length > 50) games.shift();
    localStorage.setItem('gameHistory', JSON.stringify(games));
    return true;
  } catch (e) { console.warn('Failed to log game', e); return false; }
}

function getRecentGames(limit = 10) {
  try {
    const games = JSON.parse(localStorage.getItem('gameHistory') || '[]');
    return games.slice(-limit).reverse();
  } catch (e) { return []; }
}

// Calculate player game stats based on game history
function calculatePlayerStats(username) {
  try {
    const games = JSON.parse(localStorage.getItem('gameHistory') || '[]');
    let gamesPlayed = 0;
    let wins = 0;
    let civilianWins = 0;
    let imposterWins = 0;

    games.forEach(game => {
      if (game.players && game.players.includes(username)) {
        gamesPlayed++;
        if (game.won) {
          // Civilians won
          if (!game.imposters.includes(username)) {
            wins++;
            civilianWins++;
          }
        } else {
          // Imposters won
          if (game.imposters.includes(username)) {
            wins++;
            imposterWins++;
          }
        }
      }
    });

    const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
    return { gamesPlayed, wins, winRate, civilianWins, imposterWins };
  } catch (e) { return { gamesPlayed: 0, wins: 0, winRate: 0, civilianWins: 0, imposterWins: 0 }; }
}

// sidebar toggle: allow collapse to icons-only
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('sidebarToggle');
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  // apply persisted state
  try { if (localStorage.getItem('sidebarCollapsed') === '1') sidebar.classList.add('collapsed'); } catch (e) {}
  if (btn) btn.addEventListener('click', () => { sidebar.classList.toggle('collapsed'); try{ localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed') ? '1' : '0'); } catch (e) {} });
});

// Reset password function
async function resetPassword(usernameOrEmail, newPassword) {
  const accounts = _loadAccounts();
  let username = null;
  
  // Find account by username or email
  for (const [uname, acc] of Object.entries(accounts)) {
    if (uname === usernameOrEmail || acc.email === usernameOrEmail) {
      username = uname;
      break;
    }
  }
  
  if (!username) return alert('No account found with that username or email');
  if (newPassword.length < 6) return alert('Password must be at least 6 characters');
  
  const acc = accounts[username];
  acc.password = await CryptoUtil.encryptPassword(newPassword);
  _saveAccounts(accounts);
  alert('Password reset successfully!');
  return true;
}

// Delete account function
async function deleteAccount(username, password) {
  const accounts = _loadAccounts();
  if (!accounts[username]) return alert('Account not found');
  
  const acc = accounts[username];
  const isValid = await CryptoUtil.verifyPassword(password, acc.password);
  if (!isValid) return alert('Incorrect password');
  
  delete accounts[username];
  _saveAccounts(accounts);
  
  // Clear game history for this user
  try {
    const gameHistory = JSON.parse(localStorage.getItem('gameHistory') || '[]');
    const filtered = gameHistory.filter(g => !Array.isArray(g.players) || !g.players.includes(username));
    localStorage.setItem('gameHistory', JSON.stringify(filtered));
  } catch (e) {}
  
  // Logout
  localStorage.removeItem('currentUser');
  alert('Account deleted successfully');
  return true;
}

// Wire up delete account button
const deleteAccountBtn = document.getElementById('deleteAccountBtn');
const deleteAccountModal = document.getElementById('deleteAccountModal');
const deleteAccountCancelBtn = document.getElementById('deleteAccountCancelBtn');
const deleteAccountConfirmBtn = document.getElementById('deleteAccountConfirmBtn');

if (deleteAccountBtn) {
  deleteAccountBtn.addEventListener('click', () => {
    deleteAccountModal.hidden = false;
    deleteAccountModal.style.display = 'flex';
  });
}

if (deleteAccountCancelBtn) {
  deleteAccountCancelBtn.addEventListener('click', () => {
    deleteAccountModal.hidden = true;
    deleteAccountModal.style.display = 'none';
    document.getElementById('deleteAccountPasswordInput').value = '';
  });
}

if (deleteAccountConfirmBtn) {
  deleteAccountConfirmBtn.addEventListener('click', async () => {
    const password = document.getElementById('deleteAccountPasswordInput').value;
    const username = getCurrentUser();
    if (!password) return alert('Enter your password');
    
    const success = await deleteAccount(username, password);
    if (success) {
      deleteAccountModal.hidden = true;
      deleteAccountModal.style.display = 'none';
      setTimeout(() => window.location.href = 'index.html', 500);
    }
  });
}

// Wire up reset password button
const resetPasswordBtn = document.getElementById('resetPasswordBtn');
const resetPasswordModal = document.getElementById('resetPasswordModal');
const resetPasswordCancelBtn = document.getElementById('resetPasswordCancelBtn');
const resetPasswordConfirmBtn = document.getElementById('resetPasswordConfirmBtn');

if (resetPasswordBtn) {
  resetPasswordBtn.addEventListener('click', () => {
    resetPasswordModal.hidden = false;
    resetPasswordModal.style.display = 'flex';
  });
}

if (resetPasswordCancelBtn) {
  resetPasswordCancelBtn.addEventListener('click', () => {
    resetPasswordModal.hidden = true;
    resetPasswordModal.style.display = 'none';
    document.getElementById('resetPasswordUsernameInput').value = '';
    document.getElementById('resetPasswordNewInput').value = '';
    document.getElementById('resetPasswordConfirmInput').value = '';
  });
}

if (resetPasswordConfirmBtn) {
  resetPasswordConfirmBtn.addEventListener('click', async () => {
    const usernameOrEmail = document.getElementById('resetPasswordUsernameInput').value;
    const newPassword = document.getElementById('resetPasswordNewInput').value;
    const confirmPassword = document.getElementById('resetPasswordConfirmInput').value;
    
    if (!usernameOrEmail) return alert('Enter username or email');
    if (!newPassword) return alert('Enter new password');
    if (newPassword !== confirmPassword) return alert('Passwords do not match');
    
    const success = await resetPassword(usernameOrEmail, newPassword);
    if (success) {
      resetPasswordModal.hidden = true;
      resetPasswordModal.style.display = 'none';
      document.getElementById('resetPasswordUsernameInput').value = '';
      document.getElementById('resetPasswordNewInput').value = '';
      document.getElementById('resetPasswordConfirmInput').value = '';
    }
  });
}

// XP Battle Pass System - 100 tiers with varying rewards
const BATTLEPASS_TIERS = Array.from({ length: 100 }, (_, i) => {
  const tier = i + 1;
  const baseReward = Math.floor(tier / 10) + 1;
  const coins = baseReward * 50 + (tier % 10) * 10;
  const cosmetics = tier % 5 === 0 ? ['cosmetic_' + tier] : [];
  const title = tier % 20 === 0 ? 'Battle Pass Tier ' + tier : '';
  
  return {
    tier,
    requiredXP: tier * 30,
    coins,
    cosmetics,
    title
  };
});

function getBattlePassTier(totalXP) {
  for (let i = BATTLEPASS_TIERS.length - 1; i >= 0; i--) {
    if (totalXP >= BATTLEPASS_TIERS[i].requiredXP) {
      return BATTLEPASS_TIERS[i];
    }
  }
  return BATTLEPASS_TIERS[0];
}

function getBattlePassProgress(totalXP) {
  const currentTier = getBattlePassTier(totalXP);
  const currentTierReq = currentTier.requiredXP;
  const nextTierIdx = Math.min(currentTier.tier, BATTLEPASS_TIERS.length - 1);
  const nextTierReq = BATTLEPASS_TIERS[nextTierIdx].requiredXP;
  const progressInTier = totalXP - currentTierReq;
  const tierWidth = nextTierReq - currentTierReq;
  const progress = Math.max(0, Math.min(100, (progressInTier / tierWidth) * 100));
  
  return {
    currentTier: currentTier.tier,
    progress,
    xpToNextTier: Math.max(0, nextTierReq - totalXP),
    totalXP
  };
}

// Battle Pass Widget Update Function (used on all pages)
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

// Initialize battle pass modal on all pages
document.addEventListener('DOMContentLoaded', () => {
  const bpModal = document.getElementById('battlePassModal');
  const bpToggleBtn = document.getElementById('bpToggleBtn');
  const bpCloseBtn = document.getElementById('closeBpBtn');
  
  if (typeof getCurrentUser === 'function') {
    const user = getCurrentUser();
    if (user) {
      if (bpToggleBtn) bpToggleBtn.removeAttribute('hidden');
      if (typeof updateBattlePassWidget === 'function') {
        updateBattlePassWidget(user);
      }
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
