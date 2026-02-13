# FleetOps Mobile Web MVP

Mobile-web-first FleetOps frontend using React + TypeScript + Vite + Tailwind, backed by Supabase (Auth, Postgres, Storage), deployable on Netlify.

## Stack

- React + TypeScript + Vite
- Tailwind CSS with FleetOps design tokens
- Supabase JS client
- React Router
- React Query
- Netlify SPA deployment

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env
```

Set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

3. Start dev server:

```bash
npm run dev
```

## Supabase Setup

Apply migration in `supabase/migrations/20260212170000_fleetops_mvp.sql`.

It creates:

- `assets`
- `usage_logs`
- `maintenance_entries`
- `downtime_events`
- `maintenance_rules`
- RLS policies on all tables
- Private storage bucket `maintenance-attachments` and owner-based object policies

## Netlify Deployment

- Build command: `npm run build`
- Publish directory: `dist`
- Required env vars:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

`netlify.toml` includes SPA redirect:

- `/* -> /index.html` (200)

## Current Status

- Step 1 complete: repo audited and frontend scaffolded
- Step 2 complete: Supabase client, auth provider, login page, protected routing
- Next: Step 3 app shell refinement and UI primitives expansion
