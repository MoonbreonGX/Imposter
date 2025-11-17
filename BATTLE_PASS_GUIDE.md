# 🎖️ Battle Pass System Documentation

## Overview

The Battle Pass system provides seasonal progression with XP-based leveling, tiered rewards, and free/premium tracks. Players earn XP through gameplay and climb tiers to unlock cosmetic and gameplay rewards.

## Features Implemented

### 1. **XP System**
Players earn XP for various in-game actions:

| Action | XP | Notes |
|--------|-----|-------|
| Win as Civilian | +50 | Civilians defeat the imposter |
| Win as Imposter | +75 | Imposter survives voting |
| Best Clue Award | +25 | Community voted best clue |
| Daily Challenge | +100 | Specific daily objectives |
| Play with Friends | +20 | Play with 2+ known players |
| Clue Streak | +50 | 5+ consecutive good clues |
| First Game | +10 | First game of the day |
| Participate Game | +5 | Complete any game |

### 2. **Tier Progression**
- **Tiers**: 1-100 (customizable per season)
- **XP per Tier**: 1000 XP (configurable)
- **Auto-level**: Tier up automatically when XP threshold reached
- **Progress Display**: Visual bar showing current XP/tier progress

### 3. **Reward System**

#### Reward Types:
- **Skins**: Avatar/profile backgrounds
- **Word Packs**: Exclusive seasonal word themes
- **Currency**: In-game currency for shop
- **Badges**: Profile achievements
- **Sound Packs**: Custom audio effects
- **Title Cards**: Special player titles

#### Free Track:
- Basic rewards accessible to all players
- One reward per 10 tiers

#### Premium Track:
- Exclusive premium-only rewards
- Unlock with $4.99 one-time purchase per season
- More frequent rewards (1 per 5 tiers)

### 4. **Seasons**
- **Duration**: 30 days per season
- **Theme**: Each season has unique theme (Cyberpunk, Halloween, etc.)
- **Countdown**: Shows time remaining until next season
- **Auto-rollover**: New season starts automatically

## Technical Architecture

### Database Tables

```
battle_passes
├── id (UUID)
├── season (INTEGER) - Season number (1, 2, 3...)
├── theme (TEXT) - Season theme
├── startDate (DATETIME)
├── endDate (DATETIME)
└── totalTiers (INTEGER) - Default 100

battle_pass_rewards
├── id (UUID)
├── seasonId (FK)
├── tier (INTEGER) - Which tier (1-100)
├── rewardType (TEXT) - Type of reward
├── rewardName (TEXT)
├── rewardDescription (TEXT)
├── isFreeTrack (BOOLEAN) - Free or premium

player_battle_pass
├── id (UUID)
├── playerId (FK)
├── seasonId (FK)
├── currentTier (INTEGER)
├── currentXP (INTEGER)
├── xpRequired (INTEGER) - XP needed for next tier
├── isPremium (BOOLEAN)
├── claimedRewards (JSON) - Array of claimed tier numbers
└── purchasedAt (DATETIME)

xp_log
├── id (UUID)
├── playerId (FK)
├── amount (INTEGER) - XP amount
├── reason (TEXT) - Why XP was awarded
└── createdAt (DATETIME)
```

### API Endpoints

#### Get Current Season
```
GET /api/battle-pass/current-season
Response: { id, season, theme, startDate, endDate, totalTiers }
```

#### Get Rewards for Season
```
GET /api/battle-pass/:seasonId/rewards
Response: [{ tier, rewardType, rewardName, rewardDescription, isFreeTrack }]
```

#### Get Player Progress
```
GET /api/battle-pass/:playerId/progress
Response: { currentTier, currentXP, xpRequired, isPremium, claimedRewards, endDate }
```

#### Add XP
```
POST /api/battle-pass/add-xp
Body: { amount, reason }
Response: { success, xpAdded, leveledUp?, newTier? }
```

#### Purchase Premium
```
POST /api/battle-pass/purchase-premium
Response: { success, message }
```

#### Claim Reward
```
POST /api/battle-pass/claim-reward
Body: { tier }
Response: { success, rewardClaimed }
```

#### Admin: Create Season
```
POST /api/battle-pass/admin/create-season
Body: { season, theme, totalTiers }
Response: { success, seasonId }
```

### Frontend Integration

#### Initialize System
```javascript
// Automatically called on page load
await BattlePass.init();
```

#### Award XP for Event
```javascript
// Called automatically after games
BattlePass.awardXPForEvent('WIN_CIVILIAN'); // +50 XP
BattlePass.awardXPForEvent('WIN_IMPOSTER'); // +75 XP
```

#### Add Custom XP
```javascript
await BattlePass.addXP(100, 'Custom reason');
```

#### Claim Reward
```javascript
await BattlePass.claimReward(10); // Claim tier 10 reward
```

#### Purchase Premium
```javascript
await BattlePass.purchasePremium(); // $4.99 one-time
```

#### Get Progress
```javascript
const percent = BattlePass.getCurrentXPProgress(); // 0-100
const tier = BattlePass.playerProgress.currentTier;
```

## UI Components

### Battle Pass Modal
- Displays current tier and XP progress
- Visual tier tracker (every 10 tiers shown)
- Premium track toggle
- Reward preview on hover

### Tier Up Notification
- Appears when player levels up
- Shows tier number and reward unlocked
- Slides in from right, auto-dismisses after 3s

### Toggle Button
- Fixed position (bottom-right)
- Opens/closes Battle Pass modal
- Shows current tier in button

## Usage Examples

### In Game.js
```javascript
// After game ends
function awardGameXP(civiliansWon) {
  const isImposter = state.imposterIndices.includes(playerIndex);
  
  if (civiliansWon && !isImposter) {
    BattlePass.awardXPForEvent('WIN_CIVILIAN'); // +50
  } else if (!civiliansWon && isImposter) {
    BattlePass.awardXPForEvent('WIN_IMPOSTER'); // +75
  }
}
```

### In Online.js
```javascript
// After round completes
OnlineGame.recordRound(roomId, secretWord, accusedId, wasImposter, points);

// Award XP to all players
Object.entries(points).forEach(([playerId, points]) => {
  GameAPI.addXP(points, 'ROUND_COMPLETION');
});
```

## Configuration

### XP Values
Edit `BattlePass.XP_SOURCES` in battle-pass.js:
```javascript
XP_SOURCES: {
  WIN_CIVILIAN: 50,      // Adjust these values
  WIN_IMPOSTER: 75,
  // ... other values
}
```

### XP Per Tier
Default: 1000 XP per tier
Change in server: Modify `xpRequired` in `player_battle_pass` table

### Reward Definitions
Create rewards when setting up season:
```javascript
// Admin endpoint
POST /api/battle-pass/admin/create-season
{
  "season": 1,
  "theme": "Cyberpunk",
  "totalTiers": 100
}
```

Then add rewards via database or admin panel.

## Production Deployment

### Before Launch

1. **Populate Initial Season**
   ```javascript
   // Admin
   await GameAPI.createSeason(1, 'Launch Season', 100);
   
   // Add rewards via database
   INSERT INTO battle_pass_rewards ...
   ```

2. **Configure XP Values**
   - Review XP amounts for balance
   - Test tier progression time

3. **Set Premium Pricing**
   - Default: $4.99/season
   - Modify in payment system

4. **Create Reward Assets**
   - Design skins and cosmetics
   - Record sound packs
   - Create word pack themes

### Monitoring

- Track average tier reached per season
- Monitor XP award distribution
- Analyze premium purchase rates
- Check daily/weekly engagement

## Future Enhancements

- [ ] Seasonal themes with UI skins
- [ ] Prestige/reset system after max tier
- [ ] Challenge pass (daily/weekly quests)
- [ ] Leaderboard points multiplier
- [ ] Battle pass for groups/teams
- [ ] Trading cosmetics between players
- [ ] Seasonal achievements/milestones
- [ ] Battle pass level gift system
- [ ] XP boost items
- [ ] Cosmetic preview in-game

## Troubleshooting

### XP Not Awarding
- Check Battle Pass initialized: `BattlePass.currentSeason` exists
- Verify user authenticated: `GameAPI.isAuthenticated()`
- Check console for errors

### Tiers Not Progressing
- Verify `xpRequired` matches tier
- Check `playerProgress.currentXP` updates
- Ensure auto-level function triggered

### Rewards Not Showing
- Confirm season has rewards: `BattlePass.rewards` populated
- Check reward tier is reachable
- Verify premium/free track setting

## Support

For issues:
1. Check console (DevTools F12)
2. Verify backend running (`http://localhost:3000/api/battle-pass/current-season`)
3. Check database: `SELECT * FROM battle_passes;`
4. Review logs in server terminal
