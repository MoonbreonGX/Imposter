// API client for Imposter Game backend
const API_URL = (typeof window !== 'undefined' && window.__API_URL__) || 'http://localhost:3000/api';

class GameAPIClient {
  constructor() {
    this.token = localStorage.getItem('gameToken');
    this.playerId = localStorage.getItem('playerId');
  }

  async request(method, endpoint, data = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (this.token) {
      options.headers.Authorization = `Bearer ${this.token}`;
    }

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, options);
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || `HTTP ${response.status}`);
      }

      return json;
    } catch (error) {
      console.error(`API Error: ${endpoint}`, error);
      throw error;
    }
  }

  // Authentication
  async register(username, email, password) {
    const result = await this.request('POST', '/auth/register', { username, email, password });
    this.setAuth(result.token, result.playerId);
    return result;
  }

  async login(username, password) {
    const result = await this.request('POST', '/auth/login', { username, password });
    this.setAuth(result.token, result.playerId);
    return result;
  }

  setAuth(token, playerId) {
    this.token = token;
    this.playerId = playerId;
    localStorage.setItem('gameToken', token);
    localStorage.setItem('playerId', playerId);
  }

  logout() {
    this.token = null;
    this.playerId = null;
    localStorage.removeItem('gameToken');
    localStorage.removeItem('playerId');
  }

  isAuthenticated() {
    return !!this.token && !!this.playerId;
  }

  // Player stats
  async getPlayerStats(playerId) {
    return this.request('GET', `/player/${playerId}/stats`);
  }

  async getLeaderboard(limit = 100) {
    return this.request('GET', `/leaderboard?limit=${limit}`);
  }

  // Game rooms
  async createRoom(gameConfig) {
    return this.request('POST', '/rooms/create', { gameConfig });
  }

  async joinRoom(roomCode) {
    return this.request('POST', '/rooms/join', { roomCode });
  }

  async getRoom(roomId) {
    return this.request('GET', `/rooms/${roomId}`);
  }

  async updateRoomState(roomId, gameState, gameData) {
    return this.request('PUT', `/rooms/${roomId}/state`, { gameState, gameData });
  }

  // Chat
  async sendChatMessage(roomId, message) {
    return this.request('POST', `/rooms/${roomId}/chat`, { message });
  }

  async getChatMessages(roomId) {
    return this.request('GET', `/rooms/${roomId}/chat`);
  }

  // Game rounds
  async recordRound(roomId, secretWord, accusedPlayerId, wasImposter, pointsData) {
    return this.request('POST', '/rounds', {
      roomId,
      secretWord,
      accusedPlayerId,
      wasImposter,
      pointsData
    });
  }

  async getRoomHistory(roomId) {
    return this.request('GET', `/rooms/${roomId}/history`);
  }

  // Battle Pass
  async getCurrentSeason() {
    return this.request('GET', '/battle-pass/current-season');
  }

  async getBattlePassRewards(seasonId) {
    return this.request('GET', `/battle-pass/${seasonId}/rewards`);
  }

  async getPlayerBattlePassProgress(playerId) {
    return this.request('GET', `/battle-pass/${playerId}/progress`);
  }

  async addXP(amount, reason) {
    return this.request('POST', '/battle-pass/add-xp', { amount, reason });
  }

  async purchasePremiumPass() {
    return this.request('POST', '/battle-pass/purchase-premium', {});
  }

  async claimReward(tier) {
    return this.request('POST', '/battle-pass/claim-reward', { tier });
  }

  async createSeason(season, theme, totalTiers = 100) {
    return this.request('POST', '/battle-pass/admin/create-season', { season, theme, totalTiers });
  }

  async getGems(playerId) {
    return this.request('GET', '/api/player/' + playerId + '/gems', null);
  }

  async addGems(amount, reason) {
    return this.request('POST', '/api/player/gems/add', { amount, reason });
  }

  async spendGems(amount, reason) {
    return this.request('POST', '/api/player/gems/spend', { amount, reason });
  }

  async getDailyChallenge() {
    return this.request('GET', '/api/daily-challenges', null);
  }

  async getDailyChallengeProgress(playerId) {
    return this.request('GET', '/api/daily-challenges/progress/' + playerId, null);
  }

  async completeDailyChallenge(challengeId) {
    return this.request('POST', '/api/daily-challenges/complete', { challengeId });
  }

  async setDailyChallenge(description, xpReward, gemsReward, requirements, date_active) {
    return this.request('POST', '/api/admin/daily-challenges/set', { description, xpReward, gemsReward, requirements, date_active });
  }

  async reportEvent(type, role, count = 1, metadata = {}) {
    return this.request('POST', '/api/actions/event', { type, role, count, metadata });
  }
}

// Export for use in browser
window.GameAPI = new GameAPIClient();
