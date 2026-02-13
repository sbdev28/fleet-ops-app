# FleetOps Mobile-Web MVP

FleetOps is a mobile-first fleet operations web app built with React + TypeScript and deployed on Netlify, using Supabase for Auth, Postgres, and Storage.

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS (Fleet tokens + tap target utilities)
- React Router
- React Query
- Supabase JS (`@supabase/supabase-js`)
- Netlify

## MVP Scope Implemented

- Auth login/session with Supabase (`/login`)
- Protected app routes (`/dashboard`, `/assets`, `/assets/:id`, `/log`, `/alerts`, `/more`)
- Asset CRUD baseline (create/list/detail)
- Usage / maintenance / downtime log wizard
- Rules-based due status (`overdue`, `due_soon`, `ok`, `baseline`)
- Alerts page sourced from real rule evaluation
- Asset timeline CSV export (usage + maintenance + downtime)
- Mobile command-center UI with red accent theme and desktop side rail on large screens

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase project with Email/Password auth enabled

## Local Run

1. Install dependencies

```bash
npm install
```

2. Create local environment file

```bash
cp .env.example .env
```

3. Set env vars in `.env`

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

4. Run development server

```bash
npm run dev
```

## Supabase Setup

Run SQL migration:

- `supabase/migrations/20260212170000_fleetops_mvp.sql`

This creates:

- `assets`
- `usage_logs`
- `maintenance_entries`
- `downtime_events`
- `maintenance_rules`
- RLS policies on each table (`owner_id = auth.uid()`)
- Private storage bucket: `maintenance-attachments`

## Build / Typecheck

```bash
npx tsc -p tsconfig.app.json --noEmit
npm run build
```

## Netlify Deploy

`netlify.toml` is already configured:

- Build command: `npm run build`
- Publish directory: `dist`
- SPA redirect: `/* -> /index.html` (200)

In Netlify site settings, add environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Then deploy from `main`.

## Security Notes

- Never place Supabase `service_role` in frontend env vars
- `VITE_SUPABASE_ANON_KEY` is expected for client-side auth
- `.env` is ignored by git, `.env.example` is safe to commit

## Mobile QA Checklist

- Viewports: 360px to 430px
- Bottom nav visible and non-overlapping
- Tap targets remain `>= 44px` (`>= 52px` for bottom nav)
- No horizontal scroll on core routes
