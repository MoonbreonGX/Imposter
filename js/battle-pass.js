// Battle Pass System
const BattlePass = {
  currentSeason: null,
  playerProgress: null,
  rewards: [],
  xpPerTier: 1000,

  // XP Sources mapping
  XP_SOURCES: {
    WIN_CIVILIAN: 50,
    WIN_IMPOSTER: 75,
    DAILY_CHALLENGE: 100,
    PLAY_WITH_FRIENDS: 20,
    FIRST_GAME: 10,
    PARTICIPATE_GAME: 5
  },

  // Reward types definition
  REWARD_TYPES: {
    SKIN: 'skin',
    WORD_PACK: 'word_pack',
    CURRENCY: 'currency',
    BADGE: 'badge',
    SOUND_PACK: 'sound_pack',
    TITLE_CARD: 'title_card'
  },

  // Initialize Battle Pass system
  async init() {
    try {
      // Get current season
      this.currentSeason = await GameAPI.getCurrentSeason();
      
      // Get player progress if authenticated
      if (GameAPI.isAuthenticated() && GameAPI.playerId) {
        this.playerProgress = await GameAPI.getPlayerBattlePassProgress(GameAPI.playerId);
        
        // Get rewards for current season
        if (this.currentSeason?.id) {
          this.rewards = await GameAPI.getBattlePassRewards(this.currentSeason.id);
        }
      }

      console.log('Battle Pass initialized', { season: this.currentSeason, progress: this.playerProgress });
    } catch (error) {
      console.warn('Battle Pass initialization failed:', error);
    }
  },

  // Add XP to player
  async addXP(amount, reason) {
    if (!GameAPI.isAuthenticated()) return false;

    try {
      const result = await GameAPI.addXP(amount, reason);
      
      // Update local progress
      if (result.leveledUp) {
        this.playerProgress.currentTier = result.newTier;
        this.playerProgress.currentXP = 0;
        this.showTierUpNotification(result.newTier);
      } else {
        this.playerProgress.currentXP = result.xpAdded;
      }

      this.updateBattlePassUI();
      return true;
    } catch (error) {
      console.error('Failed to add XP:', error);
      return false;
    }
  },

  // Award XP for gameplay events
  async awardXPForEvent(eventType) {
    const amount = this.XP_SOURCES[eventType] || 0;
    if (amount > 0) {
      await this.addXP(amount, eventType);
    }
  },

  // Get current XP progress percentage
  getCurrentXPProgress() {
    if (!this.playerProgress) return 0;
    return (this.playerProgress.currentXP / this.playerProgress.xpRequired) * 100;
  },

  // Check if reward is unlocked
  isRewardUnlocked(tier) {
    if (!this.playerProgress) return false;
    return this.playerProgress.currentTier >= tier;
  },

  // Check if reward is claimed
  isRewardClaimed(tier) {
    if (!this.playerProgress) return false;
    const claimed = JSON.parse(this.playerProgress.claimedRewards || '[]');
    return claimed.includes(tier);
  },

  // Claim a reward
  async claimReward(tier) {
    if (!GameAPI.isAuthenticated()) {
      alert('Please login to claim rewards');
      return false;
    }

    if (!this.isRewardUnlocked(tier)) {
      alert('You haven\'t reached this tier yet');
      return false;
    }

    if (this.isRewardClaimed(tier)) {
      alert('You already claimed this reward');
      return false;
    }

    try {
      await GameAPI.claimReward(tier);
      const claimed = JSON.parse(this.playerProgress.claimedRewards || '[]');
      claimed.push(tier);
      this.playerProgress.claimedRewards = JSON.stringify(claimed);
      this.updateBattlePassUI();
      alert('Reward claimed!');
      return true;
    } catch (error) {
      alert('Failed to claim reward');
      return false;
    }
  },

  // Purchase premium pass (costs 200 gems)
  async purchasePremium() {
    if (!GameAPI.isAuthenticated()) {
      alert('Please login to purchase premium');
      return false;
    }

    if (this.playerProgress?.isPremium) {
      alert('You already have premium pass');
      return false;
    }

    try {
      // Check if player has enough gems
      const gemsData = await GameAPI.request('/api/player/' + GameAPI.playerId + '/gems');
      if (gemsData.gems < 200) {
        alert('You need 200 gems to purchase premium pass. You have ' + gemsData.gems + ' gems.');
        return false;
      }

      // Spend gems
      await GameAPI.spendGems(200, 'Premium Pass Purchase');
      
      // Purchase the pass
      await GameAPI.purchasePremiumPass();
      this.playerProgress.isPremium = true;
      this.updateBattlePassUI();
      alert('Premium pass purchased for 200 gems! Unlock premium rewards.');
      return true;
    } catch (error) {
      alert('Failed to purchase premium pass: ' + error.message);
      return false;
    }
  },

  // Show tier up notification
  showTierUpNotification(newTier) {
    const notification = document.createElement('div');
    notification.className = 'tier-up-notification';
    notification.innerHTML = `
      <div style="font-size: 2em; font-weight: 900; color: #00ff88;">🎉 TIER ${newTier}!</div>
      <div style="color: #9fdcff; margin-top: 8px;">New reward unlocked</div>
    `;

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, rgba(0, 217, 255, 0.2), rgba(0, 255, 136, 0.2));
      border: 2px solid #00ff88;
      border-radius: 12px;
      padding: 20px;
      z-index: 5000;
      animation: slideIn 0.5s ease-out;
    `;

    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);

    // Award 50 coins on tier up for local (client-side) accounts
    try {
      if (typeof getCurrentUser === 'function') {
        const user = getCurrentUser();
        if (user && typeof _loadAccounts === 'function' && typeof _saveAccounts === 'function') {
          const accounts = _loadAccounts();
          if (accounts[user]) {
            accounts[user].coins = (accounts[user].coins || 0) + 50;
            _saveAccounts(accounts);
            if (typeof account_refreshAllDisplays === 'function') account_refreshAllDisplays();
            // show small coins notice
            const coinNotice = document.createElement('div');
            coinNotice.className = 'tier-up-notification';
            coinNotice.style.cssText = 'position:fixed; top:80px; right:20px; padding:10px 14px; border-radius:10px; background:#ffd70022; border:2px solid #ffd700; z-index:5001;';
            coinNotice.textContent = '+50 Coins';
            document.body.appendChild(coinNotice);
            setTimeout(() => coinNotice.remove(), 2200);
          }
        }
      }
    } catch (e) { console.warn('Failed to award coins on tier up', e); }
  },

  // Update Battle Pass UI
  updateBattlePassUI() {
    const modal = document.getElementById('battlePassModal');
    if (!modal) return;

    if (!this.playerProgress) {
      modal.innerHTML = '<div style="padding: 20px; color: #ff6b6b;">Not logged in</div>';
      return;
    }

    const progressPercent = this.getCurrentXPProgress();
    const tierDisplay = this.playerProgress.currentTier;
    const xpText = `${this.playerProgress.currentXP} / ${this.playerProgress.xpRequired} XP`;

    let html = `
      <div class="bp-header">
        <div class="bp-title">🎖️ BATTLE PASS</div>
        <div class="bp-tier-display">TIER <span class="bp-tier-num">${tierDisplay}</span></div>
      </div>
      <div class="bp-progress-container">
        <div class="bp-progress-bar">
          <div class="bp-progress-fill" style="width: ${progressPercent}%;"></div>
        </div>
        <div class="bp-xp-text">${xpText}</div>
      </div>
    `;

    // Premium/Free track toggle
    if (this.playerProgress.isPremium) {
      html += `<div style="text-align: center; color: #ffaa00; font-weight: 700; margin-bottom: 12px;">✨ PREMIUM PASS</div>`;
    } else {
      html += `
        <button onclick="BattlePass.purchasePremium()" style="width: 100%; padding: 10px; background: linear-gradient(135deg, #ffaa00, #ff6b00); color: #000; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; margin-bottom: 12px;">
          Purchase Premium Pass
        </button>
      `;
    }

    // Rewards strip
    let rewardsHtml = '<div class="bp-strip">';
    for (let i = 10; i <= (this.currentSeason?.totalTiers || 100); i += 10) {
      const reward = this.rewards.find(r => r.tier === i);
      const unlocked = this.isRewardUnlocked(i);
      const claimed = this.isRewardClaimed(i);
      
      const bgColor = claimed ? '#00ff88' : unlocked ? '#4ac9ff' : '#333';
      const text = claimed ? '✓' : unlocked ? '💎' : '🔒';
      
      rewardsHtml += `
        <div class="bp-reward-box" style="background: ${bgColor}40; border: 2px solid ${bgColor}; cursor: pointer;" onclick="BattlePass.showRewardDetails(${i})">
          <div style="font-size: 1.2em; font-weight: 700;">${text}</div>
          <div style="font-size: 0.8em; color: #9fdcff;">T${i}</div>
          <div style="font-size: 0.7em; color: #ffdd00; font-weight: 700;">5💎</div>
        </div>
      `;
    }
    rewardsHtml += '</div>';

    modal.innerHTML = html + rewardsHtml;
  },

  // Show reward details
  showRewardDetails(tier) {
    const reward = this.rewards.find(r => r.tier === tier);
    if (!reward) return;

    const unlocked = this.isRewardUnlocked(tier);
    const claimed = this.isRewardClaimed(tier);

    let details = `
      <div style="font-size: 1.4em; font-weight: 700; color: #4ac9ff; margin-bottom: 12px;">Tier ${tier} Reward</div>
      <div style="color: #ffdd00; font-size: 1.2em; margin-bottom: 16px;">💎 5 Gems</div>
      <div style="color: #9fdcff; margin-bottom: 16px;">Unlock 5 gems at tier ${tier}</div>
      <div style="color: #999; font-size: 0.9em; margin-bottom: 12px;">${reward?.isFree ? 'Free Track' : 'Premium Track'}</div>
    `;

    if (!unlocked) {
      const xpNeeded = (tier * 1000) - this.playerProgress.currentXP;
      details += `<div style="color: #ff6b6b;">🔒 Need ${xpNeeded} more XP to unlock</div>`;
    } else if (!claimed) {
      details += `
        <button onclick="BattlePass.claimReward(${tier})" style="width: 100%; padding: 12px; background: #00ff88; color: #000; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; margin-top: 12px;">
          Claim 5 Gems
        </button>
      `;
    } else {
      details += `<div style="color: #00ff88; font-weight: 700;">✓ Gems Claimed</div>`;
    }

    alert(details);
  },

  // Get seasonal countdown
  getSeasonCountdown() {
    if (!this.currentSeason?.endDate) return null;
    
    const endTime = new Date(this.currentSeason.endDate).getTime();
    const now = Date.now();
    const remaining = endTime - now;

    if (remaining <= 0) return 'Season Ended';

    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  }
};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  BattlePass.init();

  // Set up Battle Pass toggle button handlers
  const toggleBtn = document.getElementById('bpToggleBtn');
  const modal = document.getElementById('battlePassModal');
  const closeBtn = document.getElementById('closeBpBtn');

  if (toggleBtn && modal) {
    // Show modal when toggle button is clicked (allow either server-auth or local accounts)
    toggleBtn.addEventListener('click', () => {
      try {
        const hasServerAuth = !!(window.GameAPI && GameAPI.isAuthenticated && GameAPI.isAuthenticated());
        const hasLocalLogin = (typeof getCurrentUser === 'function' && getCurrentUser());
        if (!hasServerAuth && !hasLocalLogin) {
          alert('Please login to access the Battle Pass');
          return;
        }
      } catch (e) {
        alert('Please login to access the Battle Pass');
        return;
      }
      modal.style.display = 'flex';
      try { BattlePass.updateBattlePassUI(); } catch (e) {}
    });

    // Hide modal when close button is clicked
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
      });
    }

    // Hide modal when clicking outside the modal content
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });

    // Initially hide the modal
    modal.style.display = 'none';
  }
});

// Add CSS for Battle Pass UI
const style = document.createElement('style');
style.textContent = `
  .bp-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .bp-modal.active {
    display: flex;
  }

  .bp-modal-content {
    background: linear-gradient(180deg, rgba(0, 50, 100, 0.9), rgba(0, 20, 50, 0.95));
    border: 2px solid #4ac9ff;
    border-radius: 20px;
    padding: 30px;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 0 60px rgba(74, 201, 255, 0.3);
  }

  .bp-modal-close-btn {
    position: absolute;
    top: 10px;
    right: 15px;
    background: none;
    border: none;
    font-size: 2em;
    color: #4ac9ff;
    cursor: pointer;
  }

  .bp-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .bp-title {
    font-size: 1.8em;
    font-weight: 900;
    color: #4ac9ff;
  }

  .bp-tier-display {
    font-size: 1.2em;
    color: #9fdcff;
    font-weight: 700;
  }

  .bp-tier-num {
    color: #00ff88;
    font-size: 1.4em;
  }

  .bp-progress-container {
    margin-bottom: 20px;
  }

  .bp-progress-bar {
    background: rgba(0, 0, 0, 0.5);
    border: 2px solid #4ac9ff;
    border-radius: 10px;
    height: 30px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .bp-progress-fill {
    background: linear-gradient(90deg, #4ac9ff, #00ff88);
    height: 100%;
    transition: width 0.5s ease;
  }

  .bp-xp-text {
    text-align: center;
    color: #9fdcff;
    font-weight: 700;
    font-size: 0.9em;
  }

  .bp-strip {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
    gap: 8px;
    margin-top: 20px;
  }

  .bp-reward-box {
    padding: 12px;
    border-radius: 8px;
    text-align: center;
    transition: transform 0.2s;
  }

  .bp-reward-box:hover {
    transform: scale(1.1);
  }

  .bp-toggle-btn {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: linear-gradient(135deg, #4ac9ff, #00ff88);
    color: #000;
    border: none;
    padding: 12px 16px;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    z-index: 100;
    box-shadow: 0 0 20px rgba(74, 201, 255, 0.5);
  }

  .bp-toggle-btn:hover {
    transform: scale(1.05);
  }

  .tier-up-notification {
    animation: slideIn 0.5s ease-out, slideOut 0.5s ease-in 2.5s forwards;
  }

  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
