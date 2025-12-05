# Design Guidelines: YouTube Echo Chamber Mitigation System

## Design Approach
**System-Based Approach:** Material Design with inspiration from Linear's clean layouts and YouTube Studio's familiar patterns for data-heavy, productivity-focused interface.

**Design Principles:**
- Information clarity over visual decoration
- Efficient data scanning and comprehension
- Trustworthy, professional presentation for AI analysis results
- Seamless experience between extension popup and web dashboard

---

## Typography

**Font Family:** Inter (Google Fonts) for excellent readability in UI contexts

**Type Scale:**
- Page Headers: text-3xl font-bold (30px)
- Section Headers: text-xl font-semibold (20px)
- Card Titles: text-lg font-medium (18px)
- Body Text: text-base font-normal (16px)
- Metadata/Captions: text-sm font-normal (14px)
- Labels: text-xs font-medium uppercase tracking-wide (12px)

---

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, and 16
- Component padding: p-4, p-6
- Section spacing: space-y-8, space-y-12
- Card gaps: gap-4, gap-6
- Page margins: mx-8, my-12

**Grid Structure:**
- Dashboard: max-w-7xl mx-auto for content containment
- Two-column layouts: grid-cols-1 lg:grid-cols-3 (sidebar + main content in 1:2 ratio)
- Data cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Extension popup: Fixed width 400px, max-height 600px

---

## Component Library

### Chrome Extension Popup
**Header:**
- Extension logo/icon (32px) + title
- Quick stats bar showing bias score indicator
- Settings/sync status icons (top-right)

**Main Content (Scrollable):**
- Current bias analysis card with visual meter/chart
- Top 3 recommended diverse videos (compact cards with thumbnail, title, channel)
- Quick action buttons: "View Full Dashboard" / "Refresh Analysis"

### Web Dashboard Layout

**Navigation:**
- Left sidebar (fixed, w-64): Logo, main sections (Dashboard, Analysis, Recommendations, Snapshots, Settings)
- Clean vertical nav with icons + labels
- Active state with subtle background fill

**Dashboard Content Areas:**

1. **Hero Stats Section** (no image needed - data-focused)
   - Grid of 4 stat cards showing: Total videos analyzed, Current bias score, Recommendations given, Snapshots saved
   - Each card: Large number (text-4xl), label below, subtle icon

2. **Bias Analysis Visualization**
   - Large card with chart/graph showing content distribution across topics/viewpoints
   - Color-coded segments for different categories
   - Summary text explaining the analysis

3. **Recommended Videos Section**
   - Grid layout (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
   - Video cards: Thumbnail image, title (2 lines max), channel name, view count, "Why recommended" tag
   - Each card has subtle hover lift effect

4. **Algorithm Snapshots Manager**
   - Timeline/list view of saved states
   - Each snapshot: Date/time, thumbnail gallery preview, restore button
   - "Create New Snapshot" prominent button

5. **Background Playlist Queue**
   - Table/list view showing videos queued for background playback
   - Columns: Thumbnail, Title, Channel, Status, Actions
   - Bulk actions toolbar

### UI Components

**Cards:**
- Rounded corners (rounded-lg)
- Subtle shadow (shadow-sm)
- White background with border (border)
- Padding: p-6

**Buttons:**
- Primary: Solid fill, rounded-md, px-6 py-2.5
- Secondary: Border outline, rounded-md, px-6 py-2.5
- Icon buttons: Circular or square with subtle hover background

**Badges/Tags:**
- Small pills (rounded-full px-3 py-1 text-xs) for categories, status indicators
- Semantic colors for bias indicators (balanced, skewed, etc.)

**Data Visualization:**
- Use chart libraries (Chart.js/Recharts) for bias analysis
- Simple progress bars/meters for scores
- Color-coded segments for clear categorization

---

## Images

**Video Thumbnails:** Essential throughout - use actual YouTube thumbnail URLs
- Extension popup: 80x60px thumbnails
- Dashboard recommendations: 320x180px (16:9 aspect ratio)
- Snapshot previews: 160x90px thumbnails in grid

**No hero image needed** - This is a data dashboard, not a marketing site. Lead with functionality.

---

## Animations

**Minimal and Purposeful:**
- Card hover: subtle transform scale(1.02) + shadow increase
- Data loading: Simple skeleton screens or spinner
- Page transitions: Instant, no elaborate animations
- Chart animations: Brief entry animations on data load only