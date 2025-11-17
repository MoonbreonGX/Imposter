# Cosmetics System Setup Guide

## Overview
The cosmetics system allows players to purchase and equip skins, themes, and avatars using gems earned through gameplay.

## Asset Folders

```
assets/
├── skins/          # Card/UI skin cosmetics
├── themes/         # Theme color schemes and CSS files
└── avatars/        # Player avatar/profile pictures
```

## Asset Upload Instructions

### 1. **Skins** (`/assets/skins/`)
Store sprite files for card themes and UI customizations.

**File Format:**
- Format: PNG with transparency (RGBA)
- Recommended Size: 512x512px (scales down automatically)
- Naming: `kebab-case-name.png` (e.g., `neon-purple.png`, `gold-frame.png`)

**Example Files:**
```
assets/skins/
├── neon-purple.png
├── gold-frame.png
├── dark-matter.png
└── crystal-blue.png
```

### 2. **Themes** (`/assets/themes/`)
Store CSS theme files or color palette definitions.

**File Format:**
- Format: PNG sprite (for color preview) OR .css file
- Size: 256x128px (for sprite preview)
- Naming: `theme-name.png` or `theme-name.css`

**Example Files:**
```
assets/themes/
├── dark-mode.png
├── cyberpunk.png
├── ocean-vibes.png
└── sunset.png
```

### 3. **Avatars** (`/assets/avatars/`)
Store player profile pictures and character avatars.

**File Format:**
- Format: PNG with transparency (RGBA)
- Recommended Size: 256x256px
- Naming: `avatar-name.png` (e.g., `ninja-mask.png`, `astronaut.png`)

**Example Files:**
```
assets/avatars/
├── ninja-mask.png
├── astronaut.png
├── robot-head.png
└── alien.png
```

## Adding Cosmetics to the Database

### 1. Create DB Entry
Once you have uploaded sprite files to the appropriate folder, add entries to the `cosmetic_items` table:

**Server Endpoint (admin):**
```
POST /api/admin/cosmetics
{
  "name": "Neon Purple",
  "type": "skin",
  "description": "Vibrant neon purple card theme",
  "rarity": "rare",
  "price": 100,
  "assetUrl": "/assets/skins/neon-purple.png"
}
```

**Rarity Levels** (with pricing guidelines):
- `common` - 25-50 gems
- `uncommon` - 50-100 gems
- `rare` - 100-200 gems
- `epic` - 200-400 gems
- `legendary` - 400+ gems

### 2. Shop Display
Once added to the database, cosmetics appear in the shop automatically:
- Items grouped by type (skins, themes, avatars)
- Color-coded borders by rarity
- Preview image from assetUrl
- Buy/Equip buttons based on ownership

## Cosmetics Table Structure

### `cosmetic_items` Table
```sql
CREATE TABLE cosmetic_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- 'skin', 'theme', 'avatar'
  name TEXT NOT NULL,
  description TEXT,
  rarity TEXT NOT NULL,         -- 'common', 'uncommon', 'rare', 'epic', 'legendary'
  price INT NOT NULL,           -- gem cost
  assetUrl TEXT NOT NULL,       -- path to sprite file
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### `player_inventory` Table
```sql
CREATE TABLE player_inventory (
  id TEXT PRIMARY KEY,
  playerId TEXT NOT NULL,
  itemId TEXT NOT NULL,
  owned INT DEFAULT 0,          -- 1 if player owns it
  equipped INT DEFAULT 0,       -- 1 if currently equipped
  acquiredAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(itemId) REFERENCES cosmetic_items(id)
)
```

## API Endpoints

### Shop Cosmetics
- **GET** `/api/shop/items` - List all cosmetics
- **GET** `/api/shop/inventory` (auth) - Get player's owned items
- **POST** `/api/shop/buy/:itemId` (auth) - Purchase cosmetic (deducts gems)
- **POST** `/api/shop/equip/:itemId` (auth) - Equip cosmetic (unequips others of same type)

### Admin (future)
- **POST** `/api/admin/cosmetics` (admin) - Create new cosmetic item
- **PUT** `/api/admin/cosmetics/:itemId` (admin) - Update cosmetic
- **DELETE** `/api/admin/cosmetics/:itemId` (admin) - Remove cosmetic

## Frontend Integration

### Displaying Active Cosmetics
The shop automatically:
1. Fetches all cosmetics via `/api/shop/items`
2. Fetches player inventory via `/api/shop/inventory`
3. Displays items grouped by type
4. Shows rarity color-coded borders
5. Prevents equipped items of same type (unequips others when equipping)

### Asset Preview in Shop
Each cosmetic displays its `assetUrl` as a preview image:
- Centered in 100px box
- Maintains aspect ratio
- Falls back to type label if URL is missing

## Image Specifications

### Best Practices
- **Skins**: Design for card backgrounds; consider layering
- **Themes**: Provide both preview image and color palette
- **Avatars**: Round or square with transparent padding
- **File Size**: Keep under 200KB per asset (optimize with TinyPNG)
- **Format**: Always use PNG for quality and transparency

### Color Rarity Guide (UI)
```
Common     #999999 (Gray)
Uncommon   #4fc3f7 (Light Blue)
Rare       #1976d2 (Dark Blue)
Epic       #7c4dff (Purple)
Legendary  #ffc400 (Gold)
```

## Quick Start Example

### 1. Add a Cosmetic Item (SQL)
```sql
INSERT INTO cosmetic_items 
  (id, type, name, description, rarity, price, assetUrl)
VALUES
  ('neon-1', 'skin', 'Neon Purple', 'Vibrant neon purple theme', 'rare', 100, '/assets/skins/neon-purple.png');
```

### 2. Upload Image
Place `neon-purple.png` in `/assets/skins/`

### 3. Game Restart
Player can now see the cosmetic in the shop and purchase with gems

## File Reference Examples

### Skins
- `/assets/skins/neon-purple.png` → Neon Purple Skin
- `/assets/skins/gold-frame.png` → Gold Frame Skin
- `/assets/skins/dark-matter.png` → Dark Matter Skin

### Themes
- `/assets/themes/dark-mode.png` → Dark Mode Theme
- `/assets/themes/cyberpunk.png` → Cyberpunk Theme
- `/assets/themes/ocean-vibes.png` → Ocean Vibes Theme

### Avatars
- `/assets/avatars/ninja-mask.png` → Ninja Mask Avatar
- `/assets/avatars/astronaut.png` → Astronaut Avatar
- `/assets/avatars/robot-head.png` → Robot Avatar

## Testing

### Local Testing
1. Upload image to appropriate folder
2. Add DB entry with correct `assetUrl`
3. Restart server
4. Log in to shop and verify cosmetic appears
5. Try purchasing (if enough gems) and equipping

### Debugging
- **Item not showing**: Check `assetUrl` matches file path
- **Image not loading**: Verify file exists in assets folder
- **Purchase fails**: Check player has enough gems
- **Equip fails**: Check item is owned first (buy before equip)

---

**Last Updated:** Project implementation phase
**Maintained By:** Admin team
