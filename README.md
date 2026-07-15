# Rental App

A simple room-rental listing app.

- The **manager** logs in, adds rooms with photos, rent, and who the room is
  for, and marks each room **empty** or **occupied**.
- Only rooms marked **empty** are shown on the public site.
- Visitors browsing the public site can request a viewing on any listed room.
  The request form collects name, email, phone, visa status in Canada,
  which gender the room is required for, and the date the room is needed
  from.
- The manager sees all requests in a dashboard tab and can update their
  status (New / Contacted / Scheduled / Closed).

## Stack

- React 19 + Vite + Tailwind CSS
- Supabase (Postgres + Auth + Storage) as the backend — no custom server

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
   (use its own project, separate from any other app).
2. In the SQL editor, run the migration in
   `supabase/migrations/20260715000000_init_rental_app.sql`. This creates:
   - `rooms`, `room_photos`, `visit_requests` tables
   - Row Level Security policies so the public can only ever see rooms with
     `status = 'empty'` (and can only insert visit requests for those rooms)
   - A public `room-photos` storage bucket, writable only by the
     authenticated manager who owns the room
3. In **Authentication → Users**, manually create one user per manager
   (email + password). There is no public sign-up — this keeps the
   dashboard private to whoever you create accounts for.

## 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from
**Project Settings → API** in your Supabase dashboard.

## 3. Run locally

```bash
npm install
npm run dev
```

- Public site: `http://localhost:5173/`
- Manager login: `http://localhost:5173/admin/login`

## 4. Deploy

Any static host works (Vercel, Netlify, etc.) — build with `npm run build`
and set the same two `VITE_SUPABASE_*` environment variables in the host's
project settings. This app talks directly to Supabase from the browser, so
no server/API deployment is needed.

## How room visibility works

- A room's `status` is either `empty` or `occupied`.
- The public listing and room detail pages query
  `rooms` filtered to `status = 'empty'` — and the RLS policy backs that up
  at the database level, so occupied rooms are never visible to anon
  requests even if someone bypasses the UI.
- Toggling status in the manager dashboard is what adds/removes a room from
  the public site — no separate publish step.
