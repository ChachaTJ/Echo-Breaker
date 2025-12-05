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
  - Tracks where each video was discovered: watch_history, home_feed, subscriptions, search, recommended
  - Different bubble ring styles in visualization:
    - Watch History: solid blue ring
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
- **NEW: AI-Adaptive DOM Selector Discovery**
  - Automatically detects when YouTube changes its DOM structure
  - Uses GPT-4o-mini to analyze HTML and generate new CSS selectors
  - Three-tier fallback: cached selectors → default selectors → AI-generated
  - Server-side selector caching with 24-hour TTL to reduce API costs
  - Client-side caching in chrome.storage.local for instant retrieval
  - API endpoint: `POST /api/analyze-dom` and `GET /api/selectors`
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
- **NEW: Developer Test Mode**
  - Toggle in Settings > Developer Mode to enable constellation test mode
  - Shows sample data (24 mock videos in 6 clusters) when enabled
  - Works even without real video data for UI/feature testing
  - Setting persisted in localStorage (`constellation-test-mode`)

## Known Limitations
- Chrome extension needs icon files (16x16, 48x48, 128x128 PNG) - removed from manifest to allow loading
- Fallback analysis when OpenAI unavailable uses simplified heuristics
- In-memory storage resets on server restart (consider adding PostgreSQL for persistence)

## Development Notes
- Frontend binds to port 5000
- Uses Replit AI Integrations (no API key needed)
- In-memory storage (data resets on server restart)
- Chrome extension must be loaded as unpacked extension
