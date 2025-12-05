# EchoBreaker - YouTube Echo Chamber Mitigation System

## Overview
EchoBreaker is a web application + Chrome extension system designed to help users break free from YouTube's echo chamber by:
1. Automatically collecting and analyzing YouTube viewing patterns
2. Detecting content bias and political leaning
3. Recommending diverse content to balance the user's consumption
4. Allowing users to save and restore algorithm states via snapshots
5. Supporting background video playback for algorithm "regression"

## Technology Stack
- **Frontend**: React + TypeScript with Vite
- **Backend**: Express.js
- **Styling**: Tailwind CSS + Shadcn UI components
- **State Management**: TanStack React Query
- **AI**: OpenAI via Replit AI Integrations (for content analysis and recommendations)
- **Charts**: Recharts for data visualization
- **Routing**: Wouter

## Project Structure

```
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── ui/           # Shadcn UI components
│   │   │   ├── app-sidebar.tsx
│   │   │   ├── bias-meter.tsx
│   │   │   ├── category-chart.tsx
│   │   │   ├── playlist-table.tsx
│   │   │   ├── snapshot-card.tsx
│   │   │   ├── stat-card.tsx
│   │   │   ├── sync-status.tsx
│   │   │   ├── theme-provider.tsx
│   │   │   ├── theme-toggle.tsx
│   │   │   └── video-card.tsx
│   │   ├── pages/            # Page components
│   │   │   ├── dashboard.tsx
│   │   │   ├── analysis.tsx
│   │   │   ├── recommendations.tsx
│   │   │   ├── snapshots.tsx
│   │   │   ├── playlist.tsx
│   │   │   └── settings.tsx
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── App.tsx
│   │   └── index.css
│   └── index.html
├── server/                    # Express backend
│   ├── routes.ts             # API endpoints
│   ├── storage.ts            # In-memory storage
│   └── index.ts
├── shared/                    # Shared types and schemas
│   └── schema.ts
├── extension/                 # Chrome extension
│   ├── manifest.json
│   ├── content.js            # YouTube page content script
│   ├── background.js         # Service worker
│   ├── popup.html            # Extension popup UI
│   ├── popup.js
│   └── icons/
└── design_guidelines.md
```

## Key Features

### Web Dashboard
- **Dashboard**: Overview stats, bias score, category distribution, quick recommendations
- **Analysis**: Deep dive into viewing patterns with AI-powered analysis
- **Recommendations**: AI-generated diverse video suggestions
- **Snapshots**: Save/restore YouTube algorithm states
- **Playlist**: Manage background playback queue for algorithm regression
- **Settings**: Theme, sync preferences, data management

### Chrome Extension
- Auto-collects YouTube data (videos, subscriptions, recommendations)
- Syncs with web dashboard via API
- Shows quick stats and bias score
- Supports background video playback (muted)

## API Endpoints

### Stats & Data
- `GET /api/stats` - Dashboard statistics
- `GET /api/videos` - Collected videos
- `POST /api/crawl` - Receive crawled data from extension

### Analysis
- `GET /api/analysis/latest` - Latest analysis result
- `POST /api/analysis/run` - Run AI analysis on collected data

### Recommendations
- `GET /api/recommendations` - Get all recommendations
- `POST /api/recommendations/generate` - Generate new AI recommendations
- `PATCH /api/recommendations/:id/watched` - Mark as watched

### Snapshots
- `GET /api/snapshots` - List all snapshots
- `POST /api/snapshots` - Create new snapshot
- `POST /api/snapshots/:id/activate` - Activate snapshot (adds to playlist)
- `DELETE /api/snapshots/:id` - Delete snapshot

### Playlist
- `GET /api/playlist` - Get playlist items
- `POST /api/playlist/:id/play` - Toggle play status
- `DELETE /api/playlist/:id` - Remove item
- `DELETE /api/playlist/bulk` - Remove multiple items

### Data Management
- `GET /api/data/export` - Export all data as JSON
- `DELETE /api/data/all` - Clear all data

## User Preferences
- Dark/Light/System theme support
- Auto-sync toggle
- Sync interval configuration
- Diversity level for recommendations
- Notification preferences

## Recent Changes
- Initial MVP implementation complete
- All core features working (Dashboard, Analysis, Recommendations, Snapshots, Playlist, Settings)
- Chrome extension with auto-crawling of YouTube data
- OpenAI integration for AI-powered bias analysis with graceful fallbacks
- Theme system with dark/light mode toggle
- **NEW: Feature Toggles in Extension Popup**
  - AI Recommendation Cards: Enable/disable diverse video suggestions on YouTube
  - Stance Overlays: Enable/disable political stance badges on videos
  - Collect Shorts: Enable/disable YouTube Shorts data collection
  - Settings stored in chrome.storage.local with real-time updates
  - Instant enable/disable without page refresh (storage change listener)
- **NEW: Gemini AI Video Stance Analysis**
  - Batch video analysis using Gemini 2.5 Flash via Replit AI Integrations
  - Political stance detection: progressive, conservative, centrist, non-political
  - Stance probability distribution stored per video
  - Content type classification (political, news, entertainment, tech, etc.)
- **NEW: Shannon Entropy Viewpoint Diversity Score**
  - Calculates diversity metric from stance distribution
  - 0-100 score (100 = maximum diversity, equal distribution)
  - Displayed in dedicated Viewpoint Diversity card
- **NEW: Video Source Phase Tracking**
  - Tracks where each video was discovered with expanded source types
  - Source phases: shorts, video, playlist, watch_history, home_feed, subscriptions, search, recommended
  - Different bubble ring styles in visualization:
    - Shorts: pink dashed ring (for YouTube Shorts)
    - Video: solid blue ring (regular videos watched)
    - Playlist: violet dashed ring (videos from playlists)
    - Home Feed: dashed green ring
    - Subscriptions: dotted purple ring
    - Search: double yellow ring
    - Recommended: thin orange ring
- **NEW: Significance Weight Bubble Scaling**
  - Videos scale in bubble size based on significance (30-80 weight range)
  - Watch history videos appear larger than home feed recommendations
- **NEW: Stance Breakdown Visualization**
  - Progress bars showing political stance distribution
  - Color-coded: progressive (blue), conservative (red), centrist (green), non-political (gray)
- **Analysis Page UI Improvements**
  - Filter Bubble Visualization moved higher for prominence
  - Added Video Sources legend explaining ring styles
  - Added Viewpoint Diversity and Political Stance Distribution cards
- Proper error handling for API endpoints
- **NEW: 2D-3D Echo Chamber Visualization** (inspired by PolitEcho)
  - Interactive visualization showing channel distribution by political bias
  - 2D view: channels plotted on left-right spectrum with size by video count
  - 3D view: adds depth with rotation/zoom controls for exploring the bias landscape
  - Color coding: blue (left), green (center), red (right)
- **NEW: Self-Healing Scraper with AI Selector Discovery**
  - Automatically adapts to YouTube's DOM structure changes (December 2024 update)
  - Uses Gemini 2.5 Flash to analyze HTML snippets and discover optimal CSS selectors
  - Four-tier fallback chain for maximum reliability:
    1. Cached selectors (24h TTL, stored in chrome.storage.local)
    2. Default selectors (from DEFAULT_SELECTORS constant)
    3. AI-generated selectors (via Gemini API)
    4. Hardcoded heuristics (YouTube Dec 2024 DOM patterns)
  - HTML "diet" function reduces token usage by 80% (removes SVG, scripts, styles)
  - Supports data attributes (`data-id`, `data-video-id`) and content-id classes
  - Metadata extraction (view count, upload date) via metaSelector
  - Successful selectors are cached for faster future extraction
  - API endpoint: `POST /api/analyze-selectors`
- **NEW: yt-dlp Inspired Regex Patterns**
  - Reference: https://github.com/yt-dlp/yt-dlp
  - Video ID: 11-character `[a-zA-Z0-9_-]{11}` pattern
  - Channel UCID: `UC[0-9A-Za-z_-]{22}` pattern
  - Channel Handle: `@[0-9A-Za-z_]+` pattern
  - Playlist ID: PL/LL/EC/UU/FL/RD patterns
  - Multi-language view count parsing (views, 조회, 視聴)
  - Multi-language upload date parsing (ago, 전)
  - Duration extraction from overlay
  - 5-tier video ID extraction fallback chain
- **NEW: 3D Filter Bubble Visualization**
  - Three.js WebGL rendering with soap bubble effect nodes
  - Thumbnails distorted inside transparent bubbles using fisheye shader
  - Iridescent bubble effect with animated sheen
  - Color coding on bubble outlines and connection lines only (not fills)
  - Clean dark background (no stars/dust)
  - TF-IDF vector embeddings with PCA dimension reduction to 3D coordinates
  - K-means clustering for color-coded category groupings
  - Interactive OrbitControls with auto-rotate, zoom, pan
  - Hover tooltips and click-to-select video detail panels
  - Connection lines between related videos (same cluster)
  - Graceful WebGL fallback for unsupported environments
  - API endpoint: `GET /api/analysis/constellation`
  - **NEW: Similarity-based Hover Effects**
    - Cosine similarity matrix calculated from TF-IDF embeddings
    - Hovering over a bubble highlights similar videos with gradient opacity
    - Dissimilar videos fade to 20% opacity, similar videos stay bright
    - Creates visual "constellation" effect showing content relationships
  - **NEW: AI Pattern Analysis with Gemini**
    - Gemini 2.5 Flash analyzes viewing patterns
    - Echo chamber risk assessment (low/medium/high)
    - Diversity score (0-100) based on content variety
    - AI-generated content classifications with color coding
    - Dominant themes and blind spots identification
    - Personalized recommendations for diversifying content
    - API endpoint: `POST /api/analysis/constellation-insights`
- **NEW: Developer Test Mode**
  - Toggle in Settings > Developer Mode to enable constellation test mode
  - Shows sample data (24 mock videos in 6 clusters) when enabled
  - Works even without real video data for UI/feature testing
  - Setting persisted in localStorage (`constellation-test-mode`)
- **NEW: AI-Powered Diverse Recommendations Injection**
  - Gemini AI analyzes user's viewing patterns to detect dominant political stance
  - Automatically generates counter-perspective video recommendations
  - Injects styled recommendation cards directly into YouTube DOM
  - Cards appear in sidebar (watch page), home page, and search results
  - Multiple DOM selectors with fallback for different YouTube layouts
  - Retry mechanism for robust insertion on dynamic pages
  - Automatic cleanup and re-injection on SPA navigation
  - API endpoint: `POST /api/recommendations/diverse`
- **YouTube December 2024 DOM Structure Support**
  - `yt-lockup-view-model` structure with `content-id-{videoId}` classes
  - `yt-core-attributed-string` for video titles
  - `.yt-lockup-metadata-view-model__subtitle` for channel names
  - Shorts detection via `yt-lockup-view-model--shorts` class

## Known Limitations
- Chrome extension needs icon files (16x16, 48x48, 128x128 PNG) - removed from manifest to allow loading
- Fallback analysis when OpenAI unavailable uses simplified heuristics
- In-memory storage resets on server restart (consider adding PostgreSQL for persistence)

## Development Notes
- Frontend binds to port 5000
- Uses Replit AI Integrations (no API key needed)
- In-memory storage (data resets on server restart)
- Chrome extension must be loaded as unpacked extension
