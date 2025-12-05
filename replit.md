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
- Proper error handling for API endpoints

## Known Limitations
- Chrome extension needs icon files (16x16, 48x48, 128x128 PNG) - removed from manifest to allow loading
- Fallback analysis when OpenAI unavailable uses simplified heuristics
- In-memory storage resets on server restart (consider adding PostgreSQL for persistence)

## Development Notes
- Frontend binds to port 5000
- Uses Replit AI Integrations (no API key needed)
- In-memory storage (data resets on server restart)
- Chrome extension must be loaded as unpacked extension
