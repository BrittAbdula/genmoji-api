# Genmoji API Service

A Cloudflare Workers service built with Hono for generating and managing emoji images with AI capabilities.

## Project Structure

```
gen/
├── src/
│   ├── routes/
│   │   ├── emoji.ts        # Emoji CRUD operations
│   │   └── action.ts       # User interaction endpoints
│   ├── middleware/
│   │   ├── auth.ts         # Authentication middleware
│   │   └── cors.ts         # CORS handling middleware
│   ├── services/
│   │   ├── ai.ts           # AI service integration (Replicate)
│   │   ├── cloudflare.ts   # Cloudflare Images service
│   │   ├── database.ts     # D1 database operations
│   │   ├── stats.ts        # Statistics and analytics
│   │   └── vectorize.ts    # Vector search operations
│   ├── utils/
│   │   ├── slug.ts         # Slug generation utilities
│   │   └── language.ts     # Language detection and translation
│   ├── types/
│   │   ├── emoji.ts        # Type definitions
│   │   └── env.ts          # Environment bindings
│   └── index.ts            # Main application entry point
├── migrations/             # Database migrations
├── tests/                  # Test files
├── wrangler.toml          # Cloudflare Workers configuration
├── package.json           # Project dependencies and scripts
└── README.md             # Project documentation
```

## Features

- 🎨 AI-powered emoji generation using Replicate API
- 🔍 Vector-based semantic search with multiple language support
- 📊 Comprehensive action tracking (likes, downloads, copies, etc.)
- 🌐 Multi-language support (en, ja, zh, fr)
- 🖼️ Background removal and image processing
- ☁️ Cloudflare Images integration for storage
- 🔒 CORS and security middleware
- 📈 Real-time statistics and analytics
- 🔄 Asynchronous action processing
- 🎯 Optimized database schema for scalability

## Tech Stack

- [Hono](https://hono.dev/) - Fast, Lightweight, Web-standards Web Framework
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge Computing Platform
- [Cloudflare D1](https://developers.cloudflare.com/d1/) - SQLite Database at the Edge
- [Cloudflare Vectorize](https://developers.cloudflare.com/vectorize/) - Vector Database
- [Cloudflare Images](https://www.cloudflare.com/products/cloudflare-images/) - Image Storage and Delivery
- [Replicate](https://replicate.com/) - AI Model Deployment Platform

## API Endpoints

### Emoji Operations
- `GET /emoji/by-slug/:slug?locale={locale}` - Get emoji by slug
- `GET /emoji/related/:slug?locale={locale}&limit={limit}` - Get related emojis
- `GET /emoji/list?locale={locale}&limit={limit}&offset={offset}&sort={sort}` - List emojis
- `GET /emoji/search?q={query}&locale={locale}&limit={limit}&offset={offset}` - Search emojis
- `POST /emoji/generate` - Generate new emoji

### Action Operations
- `POST /action/:slug?locale={locale}` - Record emoji action
  ```typescript
  // Request body
  {
    "action_type": "view" |  "download" | "copy" | "report",
    "details"?: {
      "reason"?: "inappropriate" | "deceptive" | "offensive",
      "description"?: string
    }
  }
  ```
- `GET /action/:slug/stats?locale={locale}` - Get emoji statistics

## Database Schema

```sql
-- Emoji base information
CREATE TABLE emojis (
  id INTEGER PRIMARY KEY,
  prompt TEXT NOT NULL,
  base_slug TEXT NOT NULL,
  slug TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  original_prompt TEXT,
  is_public BOOLEAN DEFAULT true,
  ip TEXT,
  locale TEXT DEFAULT 'en',
  has_reference_image BOOLEAN DEFAULT false,
  model TEXT,
  UNIQUE(slug)
);
create index idx_base_slug on emojis (base_slug);

-- 创建翻译表
CREATE TABLE emoji_translations (
  id INTEGER PRIMARY KEY,
  base_slug TEXT NOT NULL,
  locale TEXT NOT NULL,
  translated_prompt TEXT NOT NULL,
  UNIQUE(base_slug, locale)
);

-- Emoji detailed information
CREATE TABLE emoji_details (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL,
  locale TEXT NOT NULL,
  category TEXT CHECK (
    category IN (
      'smileys_emotion',
      'people_body',
      'animals_nature',
      'food_drink',
      'travel_places',
      'activities',
      'objects',
      'symbols',
      'flags'
    )
  ),
  primary_color TEXT,
  keywords JSON NOT NULL DEFAULT '[]',
  quality_score FLOAT,
  subject_count INTEGER,
  UNIQUE(slug)
);

-- Emoji statistics (updated asynchronously)
CREATE TABLE emoji_stats (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL,
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  downloads_count INTEGER DEFAULT 0,
  copies_count INTEGER DEFAULT 0,
  reports_count INTEGER DEFAULT 0,
  average_rating FLOAT DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  total_rating INTEGER DEFAULT 0,
  vote_count INTEGER DEFAULT 0,
  source TEXT,
  total_actions_count INTEGER DEFAULT 0,
  last_updated_at DATETIME NOT NULL,
  UNIQUE(slug, locale)
);

-- User actions log
CREATE TABLE emoji_actions (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL,
  locale TEXT NOT NULL,
  user_id TEXT,
  user_ip TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (
    action_type IN (
      'view',
      'like',
      'download',
      'copy',
      'report',
      'rate'
    )
  ),
  action_details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reports details
CREATE TABLE emoji_reports (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL,
  locale TEXT NOT NULL,
  user_id TEXT,
  reason TEXT NOT NULL CHECK (
    reason IN (
      'inappropriate',
      'deceptive',
      'offensive'
    )
  ),
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK (
    status IN (
      'pending',
      'reviewed',
      'resolved'
    )
  ),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_emoji_details_category ON emoji_details(category);
CREATE INDEX idx_emoji_details_keywords ON emoji_details(keywords);
CREATE INDEX idx_emoji_actions_type ON emoji_actions(action_type, created_at);
-- CREATE INDEX idx_emoji_actions_user ON emoji_actions(user_ip, slug, locale, action_type);
-- CREATE INDEX idx_emoji_reports_status ON emoji_reports(status);

-- New table for likes with correct unique constraint
CREATE TABLE emoji_likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  locale TEXT NOT NULL,
  user_id TEXT,
  user_ip TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(slug, user_ip, user_id)
);

INSERT INTO emoji_likes_new (slug, locale, user_id, user_ip, created_at, is_active)
SELECT DISTINCT 
  emoji_slug,
  'en',
  '',
  user_ip,
  created_at,
  true
FROM emoji_likes;

ALTER TABLE emoji_likes RENAME TO emoji_likes_old;
ALTER TABLE emoji_likes_new RENAME TO emoji_likes;


### API Changes

#### Toggle Like Emoji
```http
POST /action/{slug}/like
```

Request body:
```json
{
  "locale": "string",
  "user_id": "string" // optional
}
```

Response:
```json
{
  "success": true,
  "data": {
    "liked": boolean
  }
}
```

#### Get Emoji Like Status
```http
GET /action/{slug}/like-status
```

Query parameters:
- `locale`: string
- `user_id`: string (optional)

Response:
```json
{
  "success": true,
  "data": {
    "liked": boolean
  }
}
```
