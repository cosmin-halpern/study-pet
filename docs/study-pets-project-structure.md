# Project structure

Where every file goes, and what each one is responsible for.

```
study-pets/
├── .env.local                       # secrets — gitignored
├── .gitignore
├── next.config.ts
├── package.json
├── tsconfig.json
├── vercel.json                      # the hourly cron entry
│
├── public/
│   ├── manifest.json                # makes it installable
│   ├── sw.js                        # service worker — push + notification click
│   ├── icon-192.png
│   └── icon-512.png
│
├── supabase/
│   └── schema.sql                   # tables, RLS, all four functions
│
└── src/
    ├── middleware.ts                # refreshes the auth session on every request
    │
    ├── lib/
    │   ├── creatures.ts             # SPECIES, MOODS, THRESH, ART, face(), lvOf()
    │   ├── push.ts                  # enablePush() — client-side subscribe
    │   └── supabase/
    │       ├── client.ts            # browser client
    │       └── server.ts            # server client (cookies)
    │
    ├── components/
    │   ├── Pet.tsx                  # one creature, given species/level/face/color
    │   ├── Tank.tsx                 # dark panel: pet, mood, health bar, evo pips
    │   ├── CheckIn.tsx              # the five subject buttons + submit
    │   ├── Roster.tsx               # 5-slot grid, tap to set active
    │   ├── Stats.tsx                # streak / best / total / caught
    │   └── Banner.tsx               # "Caught Sprig!" / "Cedar!" flash
    │
    └── app/
        ├── layout.tsx               # metadata, manifest link, fonts
        ├── globals.css
        ├── page.tsx                 # the whole game — server component
        ├── actions.ts               # loadGame(), checkIn(), saveActive()
        │
        ├── login/
        │   └── page.tsx             # magic link form
        │
        ├── auth/callback/
        │   └── route.ts             # exchanges the code for a session
        │
        └── api/cron/nag/
            └── route.ts             # 9pm push, called hourly by Vercel
```

---

## What lives where, and why

### `src/lib/creatures.ts`
Pure functions, zero React, zero Supabase. Copy `SPECIES`, `MOODS`, `THRESH`,
`ART`, `face()` and `lvOf()` out of the artifact unchanged.

Keeping this dependency-free matters more than it looks: it means the cron job
can import `MOODS` to write a notification body without dragging React in, and
you can unit-test evolution thresholds without a database.

```ts
export const SPECIES = [
  { id: 'js',  stage: 'Advanced JS', names: ['Sprig','Sapling','Cedar'],  hue: '#5C9E6E' },
  { id: 'fe',  stage: 'Frontend',    names: ['Panel','Frame','Atrium'],   hue: '#4E7FA8' },
  { id: 'ai',  stage: 'AI Engineer', names: ['Wisp','Ember','Beacon'],    hue: '#8E6BAE' },
  { id: 'be',  stage: 'Backend',     names: ['Stax','Vault','Bedrock'],   hue: '#A8763A' },
  { id: 'alg', stage: 'Algorithms',  names: ['Loop','Spiral','Helix'],    hue: '#BF6450' },
] as const;

export type SpeciesId = (typeof SPECIES)[number]['id'];
export const THRESH = [0, 10, 30] as const;
export const lvOf = (d: number) => (d >= 30 ? 2 : d >= 10 ? 1 : 0);
```

Export `SpeciesId` and use it everywhere. It means a typo like `'algo'` is a
compile error rather than a runtime `unknown species` from Postgres.

---

### `src/app/page.tsx` — server component
Fetches on the server, renders, passes down. No `useEffect` fetching.

```tsx
import { redirect } from 'next/navigation';
import { loadGame } from './actions';
import { Tank } from '@/components/Tank';
import { Roster } from '@/components/Roster';
import { Stats } from '@/components/Stats';

export default async function Home() {
  const game = await loadGame();
  if (!game) redirect('/login');

  return (
    <main className="max-w-xl mx-auto px-5 py-9">
      <Tank {...game} />
      <Stats {...game} />
      <Roster {...game} />
    </main>
  );
}
```

Because `sync_state()` runs inside `loadGame()`, decay settles the moment the
page loads. There's no client-side timer and nothing to get out of sync.

---

### `src/components/` — the split
`Tank` and `Roster` are client components (they hold the active-pet selection
and the banner animation). `Pet`, `Stats` and `Banner` are dumb — props in,
markup out, no state.

Rough rule: if it calls `useState`, it's a client component. Everything else
stays a server component so it ships no JavaScript.

---

### `src/app/actions.ts`
Every write goes through here, and every one is a thin wrapper over an RPC.
No business logic in TypeScript — the rules live in Postgres where two devices
can't race them.

```ts
'use server';

export async function loadGame() { /* rpc: sync_state + select pets */ }
export async function checkIn(species: SpeciesId) { /* rpc: check_in */ }
export async function saveActive(species: SpeciesId) { /* update pet_state.active */ }
```

Three functions. If this file grows past five, something that belongs in SQL
has leaked upward.

---

### `supabase/schema.sql`
Keep the SQL in the repo even though you paste it into the dashboard. When you
break something at 1am you'll want the working version in git, and when you
add a sixth species you'll want to see what the fifth one needed.

---

## Build order

Do it in this sequence — each step is verifiable before the next one exists:

1. **Scaffold + Supabase project.** Confirm `npm run dev` serves a page.
2. **Run `schema.sql`.** Test `check_in('js')` directly in the SQL editor.
   It should work once and return `already_checked_in` the second time.
3. **Auth.** Get to a page that prints your user id. Nothing else.
4. **`loadGame()`.** Render raw JSON on the page. Ugly is correct here.
5. **`Pet.tsx`.** One creature on screen. Now it's a thing.
6. **`CheckIn` + `Tank`.** The core loop works end to end.
7. **`Roster`.** Catching becomes visible.
8. **Deploy to Vercel.** Test check-in from the iPad and the laptop on the
   same day — the second one should refuse.
9. **PWA manifest, add to home screen.**
10. **Push last.** It's the fiddliest part and the app is already useful
    without it.

Steps 1 to 7 are one evening. Step 8 catches the multi-device bugs. Steps 9
and 10 are the second evening.

If you stop after step 8 you still have a working synced tracker. That's a
legitimate place to stop.
