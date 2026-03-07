# HomePace — Chore Scoring App

A couples / household chore-tracking app that turns daily tasks into friendly competition. Log completions, earn points, redeem rewards, and stay on top of household duties together.

---

## Features

### Core
- **Multi-member households** — two members share a household via PIN
- **Task management** — create tasks with icons, categories, frequency (daily/weekly), points value, and max completions per cycle
- **Task logging** — one-tap completion on Today view; backfill past dates with quick log/undo buttons
- **Points & scoreboard** — per-member points with real-time sync across devices (Supabase Realtime)

### Dashboard
- Summary scorecards (this week / this month)
- **Filterable charts** — filter by member and date range (7 / 30 / 90 days)
- Points Over Time (daily bar chart)
- Cumulative Race (line chart)
- Daily Edge (gap bar chart, hidden in single-member view)
- Per-Task Breakdown (horizontal bar chart)

### Achievements
| Badge | Trigger |
|-------|---------|
| 🏆 Top Scorer This Week | Highest points in the current week |
| 🔥 N-Day Streak | 3+ consecutive days with any completion |
| ⚡ Task Master | Same task completed 7 days in a row |
| 🌟 Perfect Day | All daily tasks done in a single day (last 7 days) |
| 💎 Consistency King | 30+ consecutive days with completions |

Mini achievement badges also appear on the Today page for the current member.

### Rewards
- Create rewards with emoji, name, points cost, and optional **category**
- Rewards grouped by category in the catalog
- Per-member **points progress bar** toward the next affordable reward
- **Redemption history** with member filter tabs and date grouping

### Settings
- **Dark mode** toggle (system / light / dark)
- **Daily reminder** — browser notification at 9 PM if tasks remain (requires permission)

---

## Tech Stack

| Layer | Library |
|-------|---------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (Radix UI primitives) |
| Database | Supabase (PostgreSQL + Realtime) |
| Charts | Recharts |
| Animations | Framer Motion |
| Theme | next-themes |
| PWA | vite-plugin-pwa (Workbox) |

---

## Installation & Setup

### 1. Prerequisites

- **Node.js 18+** — [install via nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- **npm** (bundled with Node.js)
- **A Supabase account** — [supabase.com](https://supabase.com) (free tier is sufficient)
- **A deployed URL** (for PWA install on iPhone, `localhost` works for testing on Mac)

---

### 2. Clone & Install

```sh
git clone <YOUR_GIT_URL>
cd chore-together-score
npm install
```

---

### 3. Supabase Project Setup

#### 3a. Create a new project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Choose a name (e.g. `homepace`) and a strong database password
3. Select the region closest to your users
4. Wait ~2 minutes for the project to provision

#### 3b. Get your API credentials

1. In the Supabase dashboard, go to **Project Settings → API**
2. Copy:
   - **Project URL** (looks like `https://xxxxxxxxxxxx.supabase.co`)
   - **anon / public** key (the long `eyJ...` string)

#### 3c. Set environment variables

Create a `.env` file in the project root:

```sh
cp .env.example .env   # if .env.example exists, otherwise create manually
```

Add these two lines:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 3d. Apply database migrations

**Option A — Supabase CLI (recommended)**

```sh
# Install the CLI if you haven't already
npm install -g supabase

# Link to your remote project (use the project ref from the dashboard URL)
supabase login
supabase link --project-ref xxxxxxxxxxxx

# Push all migrations
supabase db push
```

**Option B — SQL Editor (manual)**

In the Supabase dashboard, open **SQL Editor** and run each file in `supabase/migrations/` in chronological order:

| File | What it does |
|------|-------------|
| `20260302013736_*.sql` | Core schema (households, members, tasks, completions) |
| `20260302100000_rewards.sql` | Rewards & redemptions tables |
| `20260302120000_task_category.sql` | Category column on tasks |
| `20260302130000_rewards_category.sql` | Category column on rewards |

#### 3e. Enable Row Level Security (optional but recommended)

In the Supabase dashboard, go to **Authentication → Policies** and enable RLS on all tables, or run policies appropriate for your setup. By default the app uses the `anon` key with no RLS, which is fine for private household use.

---

### 4. Run Locally

```sh
npm run dev
```

The app will be available at `http://localhost:8080`.

---

### 5. Build for Production

```sh
npm run build        # outputs to dist/
npm run preview      # preview the production build locally
```

---

### 6. Deploy (Vercel — recommended)

1. Push the repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → import the repo
3. In **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Click **Deploy** — Vercel auto-detects Vite and sets the build command

After deploy you'll get a URL like `https://homepace.vercel.app` — share this with your partner.

---

## Installing as an App (PWA)

HomePace is a **Progressive Web App** — it can be installed directly on your home screen and runs fullscreen like a native app, with no App Store required.

---

### On iPhone (Safari)

> Safari on iOS is the only browser that supports PWA install on iPhone.

1. Open Safari and navigate to your deployed URL (e.g. `https://homepace.vercel.app`)
2. Wait for the page to fully load
3. Tap the **Share** button (the box with an arrow pointing up) at the bottom of the screen
4. Scroll down in the share sheet and tap **"Add to Home Screen"**
5. Edit the name if you like (default: "ChoreScore") → tap **Add**

The app icon will appear on your home screen. Tap it to open HomePace in fullscreen, just like a native app.

> **Notifications on iPhone:** iOS requires the app to be installed to the home screen before it can send push notifications. After installing, go to **Settings → Notifications** in the app and enable Daily Reminder. iOS will prompt for notification permission the first time.

---

### On MacBook Pro

You can install the PWA from **Chrome**, **Edge**, or **Safari**.

#### Chrome or Edge (recommended)

1. Open Chrome or Edge and navigate to your deployed URL
2. Look for the **install icon** (a screen with a download arrow) in the address bar on the right side
3. Click it → **Install**
4. The app opens in its own window (no browser chrome) and appears in your Dock and Launchpad

Alternatively: click the **⋮** menu → **Cast, save, and share → Install page as app**

#### Safari on macOS

1. Open Safari and navigate to your deployed URL
2. In the menu bar, go to **File → Add to Dock…**
   *(requires macOS Sonoma 14+ and Safari 17+)*
3. Confirm the name → **Add**

The app will appear in your Dock and open in its own window.

> **Notifications on Mac:** Chrome and Edge support Web Notifications. After installing, go to **Settings** in the app and enable Daily Reminder. Your browser will ask for notification permission. Safari on macOS does not support Web Notifications for PWAs.

---

### Sharing with Your Partner

Both people need their own device with the app installed. The sync is automatic via Supabase Realtime — changes on one device appear on the other within seconds.

1. **Person A** opens the app → goes through Setup → creates the household → notes the 4-digit PIN
2. **Person B** opens the app on their device → enters the same PIN → picks their member name
3. Both are now connected to the same household

---

## Project Structure

```
src/
├── components/
│   ├── TaskCard.tsx          # Task completion card for Today view
│   ├── DayDetailDialog.tsx   # Modal for day detail
│   └── ui/                   # shadcn/ui components
├── context/
│   └── HouseholdContext.tsx  # Global state (members, tasks, completions, rewards)
├── hooks/
│   ├── useNotifications.ts   # Browser notification permission + localStorage toggle
│   └── useDailyReminder.ts   # 9 PM reminder scheduler
├── integrations/
│   └── supabase/             # Supabase client + DB types
├── lib/
│   ├── completions.ts        # getDayBounds, getTaskCompletionsForDate helpers
│   ├── constants.ts          # CATEGORIES
│   └── householdStorage.ts   # localStorage parsing
└── pages/
    ├── TodayPage.tsx         # Main logging view + progress + streak
    ├── DashboardPage.tsx     # Charts + achievements
    ├── TasksPage.tsx         # Task CRUD
    ├── RewardsPage.tsx       # Rewards catalog + redemption history
    └── SettingsPage.tsx      # Theme + notifications
supabase/
└── migrations/               # SQL migration files
```

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `households` | Household name + PIN |
| `household_members` | Members with display name + avatar color |
| `tasks` | Task definitions (name, icon, category, frequency, points) |
| `completions` | Completion records (member, task, points_earned, timestamp) |
| `rewards` | Redeemable rewards with optional category |
| `redemptions` | Redemption history |
