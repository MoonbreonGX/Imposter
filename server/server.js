const express = require('express');
const cors = require('cors');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));

// Middleware
app.use(cors());
app.use(express.json());

// Database setup: PostgreSQL by default (via DATABASE_URL), SQLite as fallback
let db = null;
const usePostgres = !!(process.env.DATABASE_URL || process.env.USE_PG === '1' || process.env.USE_PG === 'true');

if (usePostgres) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING });

  // Helper to convert sqlite-style '?' placeholders to $1, $2 for pg
  function convertPlaceholders(sql, params) {
    if (!params || params.length === 0) return { text: sql, values: [] };
    let idx = 0;
    const text = sql.replace(/\?/g, () => { idx++; return '$' + idx; });
    return { text, values: params };
  }

  db = {
    get: (sql, params, cb) => {
      const q = convertPlaceholders(sql, params || []);
      pool.query(q.text, q.values).then(r => cb(null, r.rows[0])).catch(err => cb(err));
    },
    all: (sql, params, cb) => {
      const q = convertPlaceholders(sql, params || []);
      pool.query(q.text, q.values).then(r => cb(null, r.rows)).catch(err => cb(err));
    },
    run: (sql, params, cb) => {
      const q = convertPlaceholders(sql, params || []);
      pool.query(q.text, q.values).then(r => cb && cb(null)).catch(err => cb && cb(err));
    }
  };
  console.log('Using PostgreSQL (DATABASE_URL:', !!process.env.DATABASE_URL ? 'provided' : 'not set', ')');
} else {
  const sqlite3 = require('sqlite3').verbose();
  db = new sqlite3.Database('./imposter_game.db', (err) => {
    if (err) console.error('Database error:', err);
    else console.log('Connected to SQLite database (fallback)');
  });
}

// Initialize database tables
const initializeDatabase = () => {
  db.serialize(() => {
    // Players table
    db.run(`CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      totalScore INTEGER DEFAULT 0,
      gamesPlayed INTEGER DEFAULT 0,
      gamesWon INTEGER DEFAULT 0,
      totalPoints INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      lastLoginAt DATETIME
    )`);

    // Game rooms table
    db.run(`CREATE TABLE IF NOT EXISTS game_rooms (
      id TEXT PRIMARY KEY,
      roomCode TEXT UNIQUE NOT NULL,
      hostId TEXT NOT NULL,
      gameState TEXT DEFAULT 'lobby',
      gameConfig TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hostId) REFERENCES players(id)
    )`);

    // Game room players table
    db.run(`CREATE TABLE IF NOT EXISTS room_players (
      id TEXT PRIMARY KEY,
      roomId TEXT NOT NULL,
      playerId TEXT NOT NULL,
      role TEXT,
      word TEXT,
      isReady BOOLEAN DEFAULT 0,
      joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (roomId) REFERENCES game_rooms(id),
      FOREIGN KEY (playerId) REFERENCES players(id)
    )`);

    // Game rounds table
    db.run(`CREATE TABLE IF NOT EXISTS game_rounds (
      id TEXT PRIMARY KEY,
      roomId TEXT NOT NULL,
      roundNumber INTEGER,
      secretWord TEXT,
      accusedPlayerId TEXT,
      wasImposter BOOLEAN,
      pointsData TEXT,
      completedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (roomId) REFERENCES game_rooms(id),
      FOREIGN KEY (accusedPlayerId) REFERENCES players(id)
    )`);

    // Player stats table
    db.run(`CREATE TABLE IF NOT EXISTS player_stats (
      id TEXT PRIMARY KEY,
      playerId TEXT NOT NULL,
      roundId TEXT NOT NULL,
      role TEXT,
      pointsEarned INTEGER,
      voted BOOLEAN DEFAULT 0,
      FOREIGN KEY (playerId) REFERENCES players(id),
      FOREIGN KEY (roundId) REFERENCES game_rounds(id)
    )`);

    // Chat messages table
    db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      roomId TEXT NOT NULL,
      playerId TEXT NOT NULL,
      message TEXT,
      sentAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (roomId) REFERENCES game_rooms(id),
      FOREIGN KEY (playerId) REFERENCES players(id)
    )`);

    // Player gems table
    db.run(`CREATE TABLE IF NOT EXISTS player_gems (
      id TEXT PRIMARY KEY,
      playerId TEXT NOT NULL UNIQUE,
      gems INTEGER DEFAULT 0,
      totalEarned INTEGER DEFAULT 0,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (playerId) REFERENCES players(id)
    )`);

    // Daily challenges table
    db.run(`CREATE TABLE IF NOT EXISTS daily_challenges (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      xpReward INTEGER DEFAULT 100,
      gemsReward INTEGER DEFAULT 0,
      startDate DATETIME DEFAULT CURRENT_TIMESTAMP,
      date_active DATE,
      requirements TEXT,
      createdBy TEXT,
      FOREIGN KEY (createdBy) REFERENCES players(id)
    )`);

    // Player daily challenge progress table
    db.run(`CREATE TABLE IF NOT EXISTS player_daily_progress (
      id TEXT PRIMARY KEY,
      playerId TEXT NOT NULL,
      challengeId TEXT NOT NULL,
      progress INTEGER DEFAULT 0,
      target INTEGER DEFAULT 0,
      completed BOOLEAN DEFAULT 0,
      completedAt DATETIME,
      FOREIGN KEY (playerId) REFERENCES players(id),
      FOREIGN KEY (challengeId) REFERENCES daily_challenges(id),
      UNIQUE(playerId, challengeId)
    )`);

    // Attempt to add new columns if DB was created earlier without them
    try {
      db.run("ALTER TABLE daily_challenges ADD COLUMN requirements TEXT");
    } catch (e) {}
    try {
      db.run("ALTER TABLE daily_challenges ADD COLUMN date_active DATE");
    } catch (e) {}
    try {
      db.run("ALTER TABLE player_daily_progress ADD COLUMN progress INTEGER DEFAULT 0");
    } catch (e) {}
    try {
      db.run("ALTER TABLE player_daily_progress ADD COLUMN target INTEGER DEFAULT 0");
    } catch (e) {}

    // Battle Pass table
    db.run(`CREATE TABLE IF NOT EXISTS battle_passes (
      id TEXT PRIMARY KEY,
      season INTEGER NOT NULL UNIQUE,
      theme TEXT,
      startDate DATETIME,
      endDate DATETIME,
      totalTiers INTEGER DEFAULT 100,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Battle Pass tiers/rewards table
    db.run(`CREATE TABLE IF NOT EXISTS battle_pass_rewards (
      id TEXT PRIMARY KEY,
      seasonId TEXT NOT NULL,
      tier INTEGER NOT NULL,
      rewardType TEXT,
      rewardName TEXT,
      rewardDescription TEXT,
      isFreeTrack BOOLEAN DEFAULT 1,
      FOREIGN KEY (seasonId) REFERENCES battle_passes(id)
    )`);

    // Player battle pass progress table
    db.run(`CREATE TABLE IF NOT EXISTS player_battle_pass (
      id TEXT PRIMARY KEY,
      playerId TEXT NOT NULL,
      seasonId TEXT NOT NULL,
      currentTier INTEGER DEFAULT 0,
      currentXP INTEGER DEFAULT 0,
      xpRequired INTEGER DEFAULT 1000,
      isPremium BOOLEAN DEFAULT 0,
      claimedRewards TEXT DEFAULT '[]',
      purchasedAt DATETIME,
      FOREIGN KEY (playerId) REFERENCES players(id),
      FOREIGN KEY (seasonId) REFERENCES battle_passes(id),
      UNIQUE(playerId, seasonId)
    )`);

    // Player XP log table
    db.run(`CREATE TABLE IF NOT EXISTS xp_log (
      id TEXT PRIMARY KEY,
      playerId TEXT NOT NULL,
      amount INTEGER,
      reason TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (playerId) REFERENCES players(id)
    `);
  });
};

initializeDatabase();

// Authentication endpoints
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const playerId = uuidv4();

    db.run(
      'INSERT INTO players (id, username, email, passwordHash) VALUES (?, ?, ?, ?)',
      [playerId, username, email, passwordHash],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Username or email already exists' });
          }
          return res.status(500).json({ error: 'Registration failed' });
        }

        const token = jwt.sign({ playerId, username }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ success: true, token, playerId, username });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  db.get('SELECT * FROM players WHERE username = ?', [username], async (err, player) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }

    if (!player) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, player.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    db.run('UPDATE players SET lastLoginAt = CURRENT_TIMESTAMP WHERE id = ?', [player.id]);

    const token = jwt.sign({ playerId: player.id, username: player.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ 
      success: true, 
      token, 
      playerId: player.id, 
      username: player.username,
      stats: {
        totalScore: player.totalScore,
        gamesPlayed: player.gamesPlayed,
        gamesWon: player.gamesWon,
        totalPoints: player.totalPoints
      }
    });
  });
});

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.playerId = decoded.playerId;
    req.username = decoded.username;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Player stats endpoints
app.get('/api/player/:playerId/stats', (req, res) => {
  db.get('SELECT * FROM players WHERE id = ?', [req.params.playerId], (err, player) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({
      username: player.username,
      totalScore: player.totalScore,
      gamesPlayed: player.gamesPlayed,
      gamesWon: player.gamesWon,
      totalPoints: player.totalPoints,
      createdAt: player.createdAt
    });
  });
});

app.get('/api/leaderboard', (req, res) => {
  const limit = req.query.limit || 100;

  db.all(
    'SELECT username, totalScore, gamesPlayed, gamesWon, totalPoints FROM players ORDER BY totalScore DESC LIMIT ?',
    [limit],
    (err, players) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      res.json(players);
    }
  );
});

// Game room endpoints
app.post('/api/rooms/create', verifyToken, (req, res) => {
  const { gameConfig } = req.body;
  const roomId = uuidv4();
  const roomCode = generateRoomCode();

  db.run(
    'INSERT INTO game_rooms (id, roomCode, hostId, gameConfig, gameState) VALUES (?, ?, ?, ?, ?)',
    [roomId, roomCode, req.playerId, JSON.stringify(gameConfig), 'lobby'],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to create room' });
      }

      // Add host as player
      addPlayerToRoom(roomId, req.playerId, req.username);

      res.json({ success: true, roomId, roomCode });
    }
  );
});

app.post('/api/rooms/join', verifyToken, (req, res) => {
  const { roomCode } = req.body;

  if (!roomCode) {
    return res.status(400).json({ error: 'Room code required' });
  }

  db.get('SELECT id, gameState FROM game_rooms WHERE roomCode = ?', [roomCode], (err, room) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.gameState !== 'lobby') {
      return res.status(400).json({ error: 'Game already in progress' });
    }

    addPlayerToRoom(room.id, req.playerId, req.username);
    res.json({ success: true, roomId: room.id });
  });
});

function addPlayerToRoom(roomId, playerId, username) {
  const id = uuidv4();
  db.run(
    'INSERT OR IGNORE INTO room_players (id, roomId, playerId, isReady) VALUES (?, ?, ?, ?)',
    [id, roomId, playerId, 0]
  );
}

app.get('/api/rooms/:roomId', (req, res) => {
  db.get('SELECT * FROM game_rooms WHERE id = ?', [req.params.roomId], (err, room) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    db.all(
      `SELECT p.username, p.id, rp.isReady, rp.role, rp.word 
       FROM room_players rp 
       JOIN players p ON rp.playerId = p.id 
       WHERE rp.roomId = ?`,
      [req.params.roomId],
      (err, players) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }

        res.json({
          roomId: room.id,
          roomCode: room.roomCode,
          hostId: room.hostId,
          gameState: room.gameState,
          gameConfig: JSON.parse(room.gameConfig || '{}'),
          players: players
        });
      }
    );
  });
});

app.put('/api/rooms/:roomId/state', verifyToken, (req, res) => {
  const { gameState, gameData } = req.body;

  db.run(
    'UPDATE game_rooms SET gameState = ?, gameConfig = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
    [gameState, JSON.stringify(gameData), req.params.roomId],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to update room state' });
      }
      res.json({ success: true });
    }
  );
});

// Chat endpoint
app.post('/api/rooms/:roomId/chat', verifyToken, (req, res) => {
  const { message } = req.body;
  const messageId = uuidv4();

  db.run(
    'INSERT INTO chat_messages (id, roomId, playerId, message) VALUES (?, ?, ?, ?)',
    [messageId, req.params.roomId, req.playerId, message],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to send message' });
      }
      res.json({ success: true, messageId });
    }
  );
});

app.get('/api/rooms/:roomId/chat', (req, res) => {
  db.all(
    `SELECT cm.message, p.username, cm.sentAt 
     FROM chat_messages cm 
     JOIN players p ON cm.playerId = p.id 
     WHERE cm.roomId = ? 
     ORDER BY cm.sentAt ASC`,
    [req.params.roomId],
    (err, messages) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      res.json(messages);
    }
  );
});

// Game round endpoints
app.post('/api/rounds', verifyToken, (req, res) => {
  const { roomId, secretWord, accusedPlayerId, wasImposter, pointsData } = req.body;
  const roundId = uuidv4();

  db.run(
    `INSERT INTO game_rounds (id, roomId, secretWord, accusedPlayerId, wasImposter, pointsData) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [roundId, roomId, secretWord, accusedPlayerId, wasImposter, JSON.stringify(pointsData)],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to record round' });
      }

      // Update player stats
      Object.entries(pointsData).forEach(([playerId, points]) => {
        const statId = uuidv4();
        db.run(
          `INSERT INTO player_stats (id, playerId, roundId, pointsEarned) 
           VALUES (?, ?, ?, ?)`,
          [statId, playerId, roundId, points]
        );

        // Update player total score
        db.run(
          'UPDATE players SET totalPoints = totalPoints + ? WHERE id = ?',
          [points, playerId]
        );
      });

      res.json({ success: true, roundId });
    }
  );
});

app.get('/api/rooms/:roomId/history', (req, res) => {
  db.all(
    `SELECT * FROM game_rounds WHERE roomId = ? ORDER BY completedAt DESC LIMIT 50`,
    [req.params.roomId],
    (err, rounds) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      res.json(rounds);
    }
  );
});

// Battle Pass endpoints
app.get('/api/battle-pass/current-season', (req, res) => {
  db.get('SELECT * FROM battle_passes ORDER BY season DESC LIMIT 1', (err, season) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }
    res.json(season || { error: 'No active season' });
  });
});

app.get('/api/battle-pass/:seasonId/rewards', (req, res) => {
  db.all('SELECT * FROM battle_pass_rewards WHERE seasonId = ? ORDER BY tier ASC', [req.params.seasonId], (err, rewards) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }
    res.json(rewards);
  });
});

app.get('/api/battle-pass/:playerId/progress', (req, res) => {
  const currentSeason = new Date().getMonth() + 1;
  
  db.get(
    `SELECT bp.*, bps.theme, bps.totalTiers, bps.endDate 
     FROM player_battle_pass bp 
     JOIN battle_passes bps ON bp.seasonId = bps.id 
     WHERE bp.playerId = ? AND bps.season = ? 
     LIMIT 1`,
    [req.params.playerId, currentSeason],
    (err, progress) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      res.json(progress || { currentTier: 0, currentXP: 0, xpRequired: 1000 });
    }
  );
});

app.post('/api/battle-pass/add-xp', verifyToken, (req, res) => {
  const { amount, reason } = req.body;
  const xpId = uuidv4();

  db.run(
    'INSERT INTO xp_log (id, playerId, amount, reason) VALUES (?, ?, ?, ?)',
    [xpId, req.playerId, amount, reason],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to add XP' });
      }

      // Get current battle pass progress
      const currentSeason = new Date().getMonth() + 1;
      db.get(
        `SELECT bp.*, bps.season FROM player_battle_pass bp 
         JOIN battle_passes bps ON bp.seasonId = bps.id 
         WHERE bp.playerId = ? AND bps.season = ?`,
        [req.playerId, currentSeason],
        (err, progress) => {
          if (!progress) {
            return res.json({ success: true, xpAdded: amount });
          }

          const newXP = progress.currentXP + amount;
          const xpPerTier = progress.xpRequired;
          
          if (newXP >= xpPerTier) {
            // Level up
            const newTier = progress.currentTier + 1;
            const remainingXP = newXP - xpPerTier;

            db.run(
              'UPDATE player_battle_pass SET currentTier = ?, currentXP = ? WHERE id = ?',
              [newTier, remainingXP, progress.id],
              (err) => {
                res.json({ success: true, xpAdded: amount, leveledUp: true, newTier });
              }
            );
          } else {
            db.run(
              'UPDATE player_battle_pass SET currentXP = ? WHERE id = ?',
              [newXP, progress.id],
              (err) => {
                res.json({ success: true, xpAdded: amount, leveledUp: false });
              }
            );
          }
        }
      );
    }
  );
});

app.post('/api/battle-pass/purchase-premium', verifyToken, (req, res) => {
  const currentSeason = new Date().getMonth() + 1;

  db.get(
    'SELECT id FROM battle_passes WHERE season = ?',
    [currentSeason],
    (err, season) => {
      if (!season) {
        return res.status(404).json({ error: 'No active season' });
      }

      db.run(
        'UPDATE player_battle_pass SET isPremium = 1, purchasedAt = CURRENT_TIMESTAMP WHERE playerId = ? AND seasonId = ?',
        [req.playerId, season.id],
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to purchase premium' });
          }
          res.json({ success: true, message: 'Premium battle pass purchased' });
        }
      );
    }
  );
});

app.post('/api/battle-pass/claim-reward', verifyToken, (req, res) => {
  const { tier } = req.body;
  const currentSeason = new Date().getMonth() + 1;

  db.get(
    `SELECT bp.*, bps.id as seasonId FROM player_battle_pass bp 
     JOIN battle_passes bps ON bp.seasonId = bps.id 
     WHERE bp.playerId = ? AND bps.season = ?`,
    [req.playerId, currentSeason],
    (err, progress) => {
      if (!progress || progress.currentTier < tier) {
        return res.status(400).json({ error: 'Tier not yet unlocked' });
      }

      const claimedRewards = JSON.parse(progress.claimedRewards || '[]');
      if (claimedRewards.includes(tier)) {
        return res.status(400).json({ error: 'Reward already claimed' });
      }

      claimedRewards.push(tier);
      
      // Calculate gem reward: 5 gems per 10 tiers (tiers 10, 20, 30... 100)
      let gemsAwarded = 0;
      if (tier > 0 && tier % 10 === 0) {
        gemsAwarded = 5;
      }

      db.run(
        'UPDATE player_battle_pass SET claimedRewards = ? WHERE id = ?',
        [JSON.stringify(claimedRewards), progress.id],
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to claim reward' });
          }

          // Award gems if applicable
          if (gemsAwarded > 0) {
            db.get('SELECT gems, totalEarned FROM player_gems WHERE playerId = ?', [req.playerId], (err, gems) => {
              const newBalance = (gems?.gems || 0) + gemsAwarded;
              const newTotal = (gems?.totalEarned || 0) + gemsAwarded;
              
              db.run(
                'INSERT OR REPLACE INTO player_gems (id, playerId, gems, totalEarned, updatedAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
                [gems?.id || uuidv4(), req.playerId, newBalance, newTotal],
                () => {
                  res.json({ success: true, rewardClaimed: tier, gemsAwarded });
                }
              );
            });
          } else {
            res.json({ success: true, rewardClaimed: tier, gemsAwarded: 0 });
          }
        }
      );
    }
  );
});

app.post('/api/battle-pass/admin/create-season', (req, res) => {
  const { season, theme, totalTiers = 100 } = req.body;
  const seasonId = uuidv4();
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  db.run(
    'INSERT INTO battle_passes (id, season, theme, startDate, endDate, totalTiers) VALUES (?, ?, ?, ?, ?, ?)',
    [seasonId, season, theme, startDate, endDate, 100], // Always 100 tiers
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to create season' });
      }

      // Create 100 default tier rewards
      const insertReward = (tier) => {
        if (tier > 100) {
          return res.json({ success: true, seasonId, tiersCreated: 100 });
        }

        const rewardId = uuidv4();
        const isFreeReward = tier <= 50; // First 50 tiers are free
        const isPremiumReward = tier > 50; // Tiers 51-100 are premium only

        // Gems awarded every 10 tiers
        const gemsReward = (tier % 10 === 0) ? 5 : 0;

        db.run(
          'INSERT INTO battle_pass_rewards (id, seasonId, tier, title, description, type, isFree, gemsReward) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            rewardId,
            seasonId,
            tier,
            `Tier ${tier} Reward`,
            `Unlock tier ${tier} reward`,
            tier % 10 === 0 ? 'currency' : 'cosmetic',
            isFreeReward ? 1 : 0,
            gemsReward
          ],
          (err) => {
            if (err) {
              console.error(`Error creating tier ${tier}:`, err);
            }
            insertReward(tier + 1);
          }
        );
      };

      insertReward(1);
    }
  );
});

// Gems endpoints
app.get('/api/player/:playerId/gems', (req, res) => {
  db.get('SELECT gems, totalEarned FROM player_gems WHERE playerId = ?', [req.params.playerId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }
    
    if (!row) {
      // Initialize gems for new player
      const id = uuidv4();
      db.run('INSERT INTO player_gems (id, playerId, gems, totalEarned) VALUES (?, ?, 0, 0)', [id, req.params.playerId]);
      return res.json({ gems: 0, totalEarned: 0 });
    }
    
    res.json(row);
  });
});

app.post('/api/player/gems/add', verifyToken, (req, res) => {
  const { amount, reason } = req.body;
  
  db.get('SELECT * FROM player_gems WHERE playerId = ?', [req.playerId], (err, row) => {
    if (!row) {
      const id = uuidv4();
      db.run('INSERT INTO player_gems (id, playerId, gems, totalEarned) VALUES (?, ?, ?, ?)',
        [id, req.playerId, amount, amount]);
      return res.json({ success: true, newBalance: amount });
    }
    
    const newBalance = row.gems + amount;
    const newTotal = row.totalEarned + amount;
    
    db.run('UPDATE player_gems SET gems = ?, totalEarned = ?, updatedAt = CURRENT_TIMESTAMP WHERE playerId = ?',
      [newBalance, newTotal, req.playerId],
      (err) => {
        if (err) return res.status(500).json({ error: 'Failed to add gems' });
        res.json({ success: true, newBalance });
      }
    );
  });
});

app.post('/api/player/gems/spend', verifyToken, (req, res) => {
  const { amount, reason } = req.body;
  
  db.get('SELECT gems FROM player_gems WHERE playerId = ?', [req.playerId], (err, row) => {
    if (!row || row.gems < amount) {
      return res.status(400).json({ error: 'Insufficient gems' });
    }
    
    const newBalance = row.gems - amount;
    db.run('UPDATE player_gems SET gems = ?, updatedAt = CURRENT_TIMESTAMP WHERE playerId = ?',
      [newBalance, req.playerId],
      (err) => {
        if (err) return res.status(500).json({ error: 'Failed to spend gems' });
        res.json({ success: true, newBalance });
      }
    );
  });
});

// Daily challenges endpoints
app.get('/api/daily-challenges', (req, res) => {
  // Support optional auth token so we can return player progress
  const token = req.headers.authorization?.split(' ')[1];
  let playerId = null;
  if (token) {
    try { const decoded = jwt.verify(token, JWT_SECRET); playerId = decoded.playerId; } catch (e) { playerId = null; }
  }

  // Prefer date_active if set, otherwise fallback to startDate
  db.get("SELECT * FROM daily_challenges WHERE date(COALESCE(date_active, startDate)) = date('now')", (err, challenge) => {
    if (err) return res.status(500).json({ error: 'Server error' });

    if (!challenge) return res.json({ error: 'No challenge today' });

    // parse requirements JSON if present
    try { challenge.requirements = challenge.requirements ? JSON.parse(challenge.requirements) : null; } catch (e) { challenge.requirements = null; }

    if (!playerId) return res.json(challenge);

    db.get('SELECT progress, target, completed, completedAt FROM player_daily_progress WHERE playerId = ? AND challengeId = ?', [playerId, challenge.id], (err2, prog) => {
      if (err2) return res.status(500).json({ error: 'Server error' });
      challenge.progress = prog ? prog.progress : 0;
      challenge.target = prog ? prog.target : (challenge.requirements && (challenge.requirements.wins || challenge.requirements.count || 0));
      challenge.completed = prog ? !!prog.completed : false;
      challenge.completedAt = prog ? prog.completedAt : null;
      res.json(challenge);
    });
  });
});

app.get('/api/daily-challenges/progress/:playerId', (req, res) => {
  db.get(
    `SELECT dc.*, pdp.completed, pdp.completedAt 
     FROM daily_challenges dc 
     LEFT JOIN player_daily_progress pdp ON dc.id = pdp.challengeId AND pdp.playerId = ? 
     WHERE date(dc.startDate) = date('now')`,
    [req.params.playerId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      res.json(row || { error: 'No challenge today' });
    }
  );
});

app.post('/api/daily-challenges/complete', verifyToken, (req, res) => {
  const { challengeId } = req.body;
  
  db.get('SELECT xpReward, gemsReward FROM daily_challenges WHERE id = ?', [challengeId], (err, challenge) => {
    if (!challenge) return res.status(404).json({ error: 'Challenge not found' });

    const progressId = uuidv4();
    db.run(
      'INSERT OR REPLACE INTO player_daily_progress (id, playerId, challengeId, progress, target, completed, completedAt) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)',
      [progressId, req.playerId, challengeId, challenge.gemsReward ? challenge.gemsReward : 0, challenge.gemsReward ? challenge.gemsReward : 0],
      (err) => {
        if (err) return res.status(500).json({ error: 'Failed to complete challenge' });

        // Award gems if applicable
        if (challenge.gemsReward > 0) {
          db.get('SELECT gems, totalEarned, id as gid FROM player_gems WHERE playerId = ?', [req.playerId], (err, gemsRow) => {
            const newBalance = (gemsRow?.gems || 0) + challenge.gemsReward;
            const newTotal = (gemsRow?.totalEarned || 0) + challenge.gemsReward;
            db.run('INSERT OR REPLACE INTO player_gems (id, playerId, gems, totalEarned, updatedAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
              [gemsRow?.gid || uuidv4(), req.playerId, newBalance, newTotal]);
          });
        }

        // Award XP (log)
        db.run('INSERT INTO xp_log (id, playerId, amount, reason) VALUES (?, ?, ?, ?)', [uuidv4(), req.playerId, challenge.xpReward || 0, 'Daily Challenge Reward']);

        res.json({ success: true, xpReward: challenge.xpReward, gemsReward: challenge.gemsReward });
      }
    );
  });
});

app.post('/api/admin/daily-challenges/set', verifyToken, (req, res) => {
  const { description, xpReward, gemsReward, requirements, date_active } = req.body;

  // NOTE: Add proper admin authorization check in production

  const challengeId = uuidv4();
  db.run(
    'INSERT INTO daily_challenges (id, description, xpReward, gemsReward, requirements, date_active, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [challengeId, description, xpReward || 100, gemsReward || 0, requirements ? JSON.stringify(requirements) : null, date_active || null, req.playerId],
    (err) => {
      if (err) return res.status(500).json({ error: 'Failed to create challenge' });
      res.json({ success: true, challengeId });
    }
  );
});

// Endpoint for reporting in-game events so server can track progress
app.post('/api/actions/event', verifyToken, (req, res) => {
  const { type, role, count = 1, metadata } = req.body;

  // Find today's active challenges
  db.all("SELECT * FROM daily_challenges WHERE date(COALESCE(date_active, startDate)) = date('now')", (err, challenges) => {
    if (err) return res.status(500).json({ error: 'Server error' });

    if (!challenges || challenges.length === 0) return res.json({ processed: 0 });

    let processed = 0;

    challenges.forEach((ch) => {
      let reqs = null;
      try { reqs = ch.requirements ? JSON.parse(ch.requirements) : null; } catch (e) { reqs = null; }
      if (!reqs) return;

      // Simple matching: checks role (if present) and metric keys
      if (reqs.role && role !== reqs.role) return;

      // Determine metric and target
      const metricKeys = Object.keys(reqs).filter(k => k !== 'role');
      if (metricKeys.length === 0) return;
      const metric = metricKeys[0];
      const target = reqs[metric];

      // Map incoming event types to metrics (example mapping)
      let increment = 0;
      if ((metric === 'wins' && type === 'win') || (metric === 'count' && type === 'count')) {
        increment = count;
      } else if (metric === 'clues' && type === 'clue') {
        increment = count;
      } else if (metric === 'votes' && type === 'vote') {
        increment = count;
      } else {
        return;
      }

      // Update or insert player progress
      db.get('SELECT * FROM player_daily_progress WHERE playerId = ? AND challengeId = ?', [req.playerId, ch.id], (err2, prog) => {
        if (err2) return;

        if (!prog) {
          const pid = uuidv4();
          const newProgress = Math.min(increment, target);
          const completed = newProgress >= target ? 1 : 0;
          db.run('INSERT INTO player_daily_progress (id, playerId, challengeId, progress, target, completed, completedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [pid, req.playerId, ch.id, newProgress, target, completed, completed ? new Date().toISOString() : null], (err3) => {});
          if (completed) {
            // award rewards
            if (ch.gemsReward > 0) {
              db.get('SELECT gems, totalEarned, id as gid FROM player_gems WHERE playerId = ?', [req.playerId], (err4, gemsRow) => {
                const newBalance = (gemsRow?.gems || 0) + ch.gemsReward;
                const newTotal = (gemsRow?.totalEarned || 0) + ch.gemsReward;
                db.run('INSERT OR REPLACE INTO player_gems (id, playerId, gems, totalEarned, updatedAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)', [gemsRow?.gid || uuidv4(), req.playerId, newBalance, newTotal]);
              });
            }
            db.run('INSERT INTO xp_log (id, playerId, amount, reason) VALUES (?, ?, ?, ?)', [uuidv4(), req.playerId, ch.xpReward || 0, 'Daily Challenge Auto Reward']);
          }
          processed++;
        } else {
          const newProgress = Math.min((prog.progress || 0) + increment, target);
          const completed = newProgress >= target ? 1 : 0;
          db.run('UPDATE player_daily_progress SET progress = ?, completed = ?, completedAt = ? WHERE id = ?', [newProgress, completed, completed ? new Date().toISOString() : prog.completedAt, prog.id], (err5) => {
            if (completed) {
              if (ch.gemsReward > 0) {
                db.get('SELECT gems, totalEarned, id as gid FROM player_gems WHERE playerId = ?', [req.playerId], (err6, gemsRow) => {
                  const newBalance = (gemsRow?.gems || 0) + ch.gemsReward;
                  const newTotal = (gemsRow?.totalEarned || 0) + ch.gemsReward;
                  db.run('INSERT OR REPLACE INTO player_gems (id, playerId, gems, totalEarned, updatedAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)', [gemsRow?.gid || uuidv4(), req.playerId, newBalance, newTotal]);
                });
              }
              db.run('INSERT INTO xp_log (id, playerId, amount, reason) VALUES (?, ?, ?, ?)', [uuidv4(), req.playerId, ch.xpReward || 0, 'Daily Challenge Auto Reward']);
            }
            processed++;
          });
        }
      });
    });

    // respond immediately (updates happen async)
    res.json({ processed });
  });
});

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Support HTTPS if SSL cert/key paths are provided in env
if (process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH) {
  try {
    const https = require('https');
    const key = fs.readFileSync(process.env.SSL_KEY_PATH);
    const cert = fs.readFileSync(process.env.SSL_CERT_PATH);
    https.createServer({ key, cert }, app).listen(port, () => {
      console.log(`Imposter Game Server running with HTTPS on https://localhost:${port}`);
    });
  } catch (e) {
    console.error('Failed to start HTTPS server, falling back to HTTP:', e);
    app.listen(port, () => console.log(`Imposter Game Server running on http://localhost:${port}`));
  }
} else {
  app.listen(port, () => {
    console.log(`Imposter Game Server running on http://localhost:${port}`);
  });
}
