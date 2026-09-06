# Bringing the study pets to life

A Next.js + Supabase + Vercel build. Installable on your iPad home screen,
synced across devices, and it nags you at 9pm.

**Timebox this to a weekend.** Ship it ugly. If it starts growing features,
that's the "optimising the plan instead of doing the plan" trap wearing a
costume.

---

## Step 0 — What you're building

- One Postgres database, one row per user, one row per species.
- A single server-side `check_in` function that is safe to call from two
  devices at once.
- Decay computed **on read**, not by a nightly job.
- A PWA manifest so it installs to your home screen.
- Web push at 9pm local if you haven't checked in.

The hard parts are timezones and race conditions. Everything else is CRUD.

---

## Step 1 — Scaffold

```bash
npx create-next-app@latest study-pets \
  --typescript --tailwind --app --eslint --src-dir --use-npm
cd study-pets
npm i @supabase/supabase-js @supabase/ssr web-push
npm i -D @types/web-push
```

---

## Step 2 — Supabase project

Create a project at supabase.com. Grab these from **Project Settings → API**
and put them in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # server only, never ship to client
APP_TIMEZONE=Europe/Bucharest
CRON_SECRET=some-long-random-string
```

Add `.env.local` to `.gitignore` if it isn't already.

---

## Step 3 — Schema

Run this in the Supabase SQL editor.

```sql
-- ---------- tables ----------
create table public.pet_state (
  user_id    uuid primary key references auth.users on delete cascade,
  health     int  not null default 100,
  streak     int  not null default 0,
  best       int  not null default 0,
  total      int  not null default 0,
  active     text not null default 'js',
  last_check date,
  tz         text not null default 'Europe/Bucharest',
  updated_at timestamptz not null default now()
);

create table public.pets (
  user_id uuid not null references auth.users on delete cascade,
  species text not null,
  days    int  not null default 0,
  shiny   boolean not null default false,
  caught_at timestamptz not null default now(),
  primary key (user_id, species)
);

create table public.checkins (
  user_id uuid not null references auth.users on delete cascade,
  day     date not null,
  species text not null,
  primary key (user_id, day)      -- this is what makes double check-in impossible
);

create table public.push_subs (
  user_id  uuid not null references auth.users on delete cascade,
  endpoint text primary key,
  p256dh   text not null,
  auth     text not null
);

-- ---------- row level security ----------
alter table public.pet_state  enable row level security;
alter table public.pets       enable row level security;
alter table public.checkins   enable row level security;
alter table public.push_subs  enable row level security;

create policy "own state"  on public.pet_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own pets"   on public.pets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own checkins" on public.checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own subs"   on public.push_subs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

The `checkins` primary key on `(user_id, day)` is doing quiet but important
work. It makes a second check-in on the same day a database error rather than
something your application logic has to remember to prevent. That's the
difference between correct and usually-correct.

---

## Step 4 — The two functions that matter

Both run inside Postgres so they're atomic. Two devices hitting them at the
same moment can't corrupt anything.

```sql
-- today's date in the user's own timezone
create or replace function public.user_today(p_user uuid)
returns date language sql stable as $$
  select (now() at time zone coalesce(
    (select tz from public.pet_state where user_id = p_user),
    'Europe/Bucharest'
  ))::date;
$$;
```

### Decay, applied on read

```sql
create or replace function public.sync_state()
returns public.pet_state
language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  s public.pet_state;
  d date;
  missed int;
  loss int;
begin
  if u is null then raise exception 'not authenticated'; end if;

  insert into public.pet_state (user_id) values (u)
    on conflict (user_id) do nothing;

  select * into s from public.pet_state where user_id = u;
  d := public.user_today(u);

  if s.last_check is null then return s; end if;

  missed := (d - s.last_check) - 1;
  if missed <= 0 then return s; end if;

  loss := 10;                            -- the free-ish rest day
  if missed > 1 then
    loss := loss + (missed - 1) * 28;
  end if;

  update public.pet_state
     set health = greatest(0, health - loss),
         streak = 0,
         updated_at = now()
   where user_id = u
   returning * into s;

  return s;
end $$;
```

Calling this repeatedly is safe. Because it keys off `last_check` and never
moves it, running it ten times in a row applies the same decay once.

### Check in

```sql
create or replace function public.check_in(p_species text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  d date;
  is_new boolean := false;
  is_shiny boolean := false;
  new_days int;
  s public.pet_state;
begin
  if u is null then raise exception 'not authenticated'; end if;
  if p_species not in ('js','fe','ai','be','alg') then
    raise exception 'unknown species %', p_species;
  end if;

  perform public.sync_state();          -- settle any decay first
  d := public.user_today(u);

  -- the guard: fails silently if today is already logged
  insert into public.checkins (user_id, day, species)
  values (u, d, p_species)
  on conflict (user_id, day) do nothing;

  if not found then
    return json_build_object('ok', false, 'reason', 'already_checked_in');
  end if;

  -- catch or feed
  select true into is_new
  where not exists (select 1 from public.pets where user_id = u and species = p_species);

  if is_new then
    is_shiny := (random() < 1.0/12.0);
    insert into public.pets (user_id, species, days, shiny)
    values (u, p_species, 1, is_shiny);
    new_days := 1;
  else
    update public.pets set days = days + 1
     where user_id = u and species = p_species
     returning days, shiny into new_days, is_shiny;
  end if;

  update public.pet_state
     set health = least(100, health + 30),
         streak = streak + 1,
         best   = greatest(best, streak + 1),
         total  = total + 1,
         active = p_species,
         last_check = d,
         updated_at = now()
   where user_id = u
   returning * into s;

  return json_build_object(
    'ok', true, 'caught', coalesce(is_new,false),
    'shiny', is_shiny, 'days', new_days, 'state', row_to_json(s)
  );
end $$;
```

---

## Step 5 — Supabase clients

`src/lib/supabase/server.ts`

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try { list.forEach(({ name, value, options }) => store.set(name, value, options)); }
          catch { /* called from a Server Component; middleware refreshes instead */ }
        },
      },
    }
  );
}
```

`src/lib/supabase/client.ts`

```ts
import { createBrowserClient } from '@supabase/ssr';

export const supabaseBrowser = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
```

---

## Step 6 — Auth

Magic link is the least work and there's no password to forget on the iPad.
In Supabase, turn on **Email** auth and disable **Confirm email** for now.

`src/app/login/page.tsx`

```tsx
'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  async function send() {
    await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setSent(true);
  }

  if (sent) return <p className="p-8">Check your email.</p>;

  return (
    <div className="p-8 max-w-sm mx-auto space-y-4">
      <input
        className="w-full border p-3 rounded"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        type="email"
      />
      <button onClick={send} className="w-full bg-black text-white p-3 rounded">
        Send magic link
      </button>
    </div>
  );
}
```

`src/app/auth/callback/route.ts`

```ts
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  if (code) {
    const sb = await supabaseServer();
    await sb.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL('/', url.origin));
}
```

Add `src/middleware.ts` to keep sessions fresh — copy the standard
`@supabase/ssr` middleware from the Supabase docs verbatim. It's boilerplate
and not worth hand-writing.

---

## Step 7 — Server actions

`src/app/actions.ts`

```ts
'use server';
import { supabaseServer } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function loadGame() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: state } = await sb.rpc('sync_state').single();
  const { data: pets } = await sb.from('pets').select('*');
  const { data: today } = await sb.rpc('user_today', { p_user: user.id });

  return {
    state,
    pets: pets ?? [],
    checkedInToday: state?.last_check === today,
  };
}

export async function checkIn(species: string) {
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('check_in', { p_species: species });
  if (error) return { ok: false, reason: error.message };
  revalidatePath('/');
  return data;
}
```

Note what's *not* here: no date arithmetic in JavaScript. The client never
decides what day it is. That's the single change that makes multi-device work.

---

## Step 8 — Port the creatures

Your SVG art from the artifact drops in almost unchanged. Turn each `ART`
function into a component that takes props:

```tsx
// src/components/Pet.tsx
export function Pet({
  species, level, face, color, size = 170,
}: { species: string; level: number; face: string; color: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{ ['--mood' as string]: color }}
      dangerouslySetInnerHTML={{ __html: ART[species](level, face) }}
    />
  );
}
```

Copy `ART`, `face()`, `SPECIES`, `MOODS`, `THRESH` and `lvOf` straight across
into `src/lib/creatures.ts`. Nothing about them needs to change — they're pure
functions of level and mood.

---

## Step 9 — Make it installable

`public/manifest.json`

```json
{
  "name": "Study Pets",
  "short_name": "Pets",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#16283C",
  "theme_color": "#16283C",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

In `src/app/layout.tsx`:

```ts
export const metadata = {
  title: 'Study Pets',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Pets' },
};
```

Make two PNGs (a Sprig on a navy square is fine) and drop them in `public/`.

On the iPad: open the deployed URL in Safari, Share, **Add to Home Screen**.
It has to be Safari, and it has to be the home screen icon — web push does not
work from a normal Safari tab on iOS.

---

## Step 10 — Push notifications

Generate keys once:

```bash
npx web-push generate-vapid-keys
```

Add to your env:

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=B...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
```

`public/sw.js`

```js
self.addEventListener('push', (e) => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(d.title || 'Your pet', {
      body: d.body || 'Nobody has checked in today.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: '/' },
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url));
});
```

Subscribe from the client after the user taps a button — iOS will not grant
permission from a page-load call:

```ts
export async function enablePush() {
  const reg = await navigator.serviceWorker.register('/sw.js');
  if ((await Notification.requestPermission()) !== 'granted') return;

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  });

  const j = sub.toJSON();
  await supabaseBrowser().from('push_subs').upsert({
    endpoint: j.endpoint!,
    p256dh: j.keys!.p256dh,
    auth: j.keys!.auth,
  });
}
```

`src/app/api/cron/nag/route.ts`

```ts
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('no', { status: 401 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // everyone who hasn't logged today, in their own timezone
  const { data: due } = await sb.rpc('users_needing_nag');

  for (const row of due ?? []) {
    const { data: subs } = await sb
      .from('push_subs').select('*').eq('user_id', row.user_id);

    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({
            title: row.health < 40 ? 'Your pet is fading' : 'Nothing logged today',
            body: row.health < 40
              ? `${row.health} health left. One check-in fixes it.`
              : `${row.streak} day streak. Keep it.`,
          })
        );
      } catch {
        await sb.from('push_subs').delete().eq('endpoint', s.endpoint);
      }
    }
  }

  return Response.json({ sent: due?.length ?? 0 });
}
```

The helper it calls:

```sql
create or replace function public.users_needing_nag()
returns table (user_id uuid, health int, streak int)
language sql security definer set search_path = public as $$
  select s.user_id, s.health, s.streak
  from public.pet_state s
  where s.last_check is distinct from (now() at time zone s.tz)::date
    and extract(hour from (now() at time zone s.tz)) = 21;
$$;
```

`vercel.json`

```json
{
  "crons": [{ "path": "/api/cron/nag", "schedule": "0 * * * *" }]
}
```

It runs hourly and the SQL filters to whoever's local clock says 21:00. That
way it still works if you're ever in another timezone, and you don't need a
separate cron per region.

---

## Step 11 — Deploy

```bash
git init && git add -A && git commit -m "study pets"
gh repo create study-pets --private --source=. --push
npx vercel --prod
```

Add every env var in the Vercel dashboard. Then in Supabase → Authentication →
URL Configuration, add your production URL to the redirect allow-list, or magic
links will bounce.

---

## The bugs you will actually hit

**Streak counts double or skips.** Almost always JavaScript deciding what day
it is. If you find yourself writing `new Date()` anywhere near streak logic,
stop — the date comes from `user_today()` and nowhere else.

**Magic link redirects to localhost in production.** The redirect allow-list in
Supabase, every time.

**Push works on the laptop, silent on the iPad.** It has to be launched from
the home screen icon, not a Safari tab. Also check Settings → Notifications
that the PWA appears there at all.

**Health goes negative or resets oddly.** Confirm `sync_state` is idempotent —
call it three times in a row in the SQL editor and the health should only drop
once.

---

## Scope discipline

Ship with: login, one pet on screen, five buttons, check in, roster grid,
push. That's it.

Do **not** ship with: friends, leaderboards, trading, a settings page,
dark mode, an onboarding flow, or a stats dashboard. Every one of those is
more fun to build than Advanced JS is to study, which is exactly why they
belong on a list you don't look at until the plan is done.

If you're still building this in three weeks, the pet has won and the studying
has lost.
