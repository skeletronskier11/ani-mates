# Ani-Mates

Real-time multiplayer anime picking + group compatibility scoring. Create a room, share the link, everyone picks an anime per category by searching [AniList](https://anilist.co/), and picks sync live for everyone via Supabase.

## Stack

- React + Vite (plain JS)
- [Supabase](https://supabase.com/) — Postgres + Realtime, no Auth (see security note below)
- [AniList GraphQL API](https://docs.anilist.co/) — public anime data, no API key needed
- Deploys to Vercel from this repo

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Create a free project at [supabase.com](https://supabase.com/).
2. Open **SQL Editor** in your project, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates the `rooms`, `participants`, `categories`, and `picks` tables, enables Realtime on them, and sets up Row Level Security policies.
3. Go to **Project Settings > API** and copy the **Project URL** and **anon/public key**.

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` with the values from step 2.

### 4. Run locally

```bash
npm run dev
```

Open the printed local URL, create a room, then open the room link in a second browser (or an incognito window) to join as a second participant and watch picks sync live.

## Deploying

1. Push this repo to GitHub.
2. Import it into [Vercel](https://vercel.com/).
3. In the Vercel project's **Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as `.env.local`).
4. Deploy. `vercel.json` already includes the SPA rewrite needed so a shared `/room/:roomId` link doesn't 404 on a cold load.

## Security note

This app has no login/auth — identity is just a display name plus a random ID stored in your browser's local storage. That means a room's privacy comes entirely from its link being an unguessable random ID, not from access control: anyone with a room's link can read and write everything in that room via Supabase's API, not only through this UI. That's an intentional trade-off for a casual party app. See the comments in [`supabase/schema.sql`](supabase/schema.sql) for details and the upgrade path (Supabase Anonymous Auth) if it's ever needed.
