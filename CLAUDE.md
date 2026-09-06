# Study Pets

A habit tracker for a self-directed programming curriculum. Five collectable
creatures, one per stage of the study plan. You check in on days you study;
the creature for that subject grows, and your shared health bar decays if you
go quiet.

## Stack
Next.js (App Router, TypeScript, Tailwind), Supabase (Postgres + auth),
Vercel (hosting + cron), web-push for notifications.

## Reference docs
- `docs/study-pets-build-guide.md` — full build steps, SQL, and code
- `docs/study-pets-project-structure.md` — file layout and build order

Read both before making structural changes.

---

## Non-negotiable rules

**1. All date logic lives in Postgres.**
Never call `new Date()` anywhere near streak, decay, or check-in logic. The
current date comes from the `user_today()` SQL function and nowhere else.
This is what makes checking in from a laptop at 23:50 and an iPad at 00:10
behave correctly. If you find yourself computing a day in TypeScript, stop.

**2. Business rules live in SQL functions, not TypeScript.**
`sync_state()` and `check_in()` are the two functions that matter. They run
inside Postgres so concurrent calls from two devices can't corrupt state.
`src/app/actions.ts` should stay a thin RPC wrapper — if it grows past ~5
functions, something has leaked upward and belongs back in SQL.

**3. `sync_state()` must stay idempotent.**
Calling it ten times in a row applies the same decay once. It keys off
`last_check` and never moves it. Any change that breaks this breaks the app
silently, which is the worst kind of broken.

**4. The `checkins` table's primary key is the concurrency guard.**
`primary key (user_id, day)` makes a double check-in a database conflict, not
something application code has to remember to prevent. Do not add an
application-level "have they checked in today?" check as the *only* guard.

**5. `src/lib/creatures.ts` stays dependency-free.**
No React, no Supabase imports. Pure functions of level and mood. The cron job
imports from it, and it should be unit-testable without a database.

---

## Game rules (don't silently change these)

- Check-in: +30 health, capped at 100. One per day, one subject.
- First missed day: -10 health. Rest days are intentionally cheap.
- Each further missed day: -28. Four silent days leaves the active pet at 6
  health — barely alive, not gone.
- Evolution is per species, on that species' own day count: form 2 at 10 days,
  form 3 at 30. **Never on streak** — a missed Tuesday must not demote anything.
- Day counts never decrease, even when a pet fades. Health is the short loop;
  levels are the long one.
- Shiny chance on catch: 1 in 12, rolled server-side, permanent.

These numbers are tuned to be recoverable rather than punishing. If asked to
make them harsher, say what the tradeoff is before doing it.

---

## Species

| id | Stage | Line | Hue |
|---|---|---|---|
| `js` | Advanced JS | Sprig / Sapling / Cedar | `#5C9E6E` |
| `fe` | Frontend | Panel / Frame / Atrium | `#4E7FA8` |
| `ai` | AI Engineer | Wisp / Ember / Beacon | `#8E6BAE` |
| `be` | Backend | Stax / Vault / Bedrock | `#A8763A` |
| `alg` | Algorithms | Loop / Spiral / Helix | `#BF6450` |

Use the `SpeciesId` union type everywhere. A typo like `'algo'` should be a
compile error, not a runtime Postgres exception.

---

## Design

Navy `#16283C`, gold `#B0812A`, pale cool paper `#F0F2EE`, faint graph-paper
background. Newsreader for display serif, Karla for UI sans. Match the existing
palette rather than introducing new colours.

---

## Scope

Ship with: login, one pet on screen, five subject buttons, check-in, roster
grid, push notifications. Nothing else.

Explicitly **out of scope**: friends, leaderboards, trading, settings pages,
onboarding flows, stats dashboards, dark mode toggles. If asked to add one of
these, note that it's on the out-of-scope list before building it. The project
exists to support studying, not to become the study.

---

## How I want to work with you

I'm building this partly to learn React and Next.js, so:

- **I write** the components, `actions.ts`, and the auth flow. Review my code
  and point out what's wrong, but don't rewrite it unless I ask.
- **You write** the SQL migrations, service worker, manifest, cron route, and
  other boilerplate.
- When I get something wrong, explain why rather than just fixing it.
- Prefer showing me the failing case over patching around it.

---

## Verify before saying it works

- `check_in('js')` twice in the same day → second call returns
  `already_checked_in`.
- `sync_state()` three times in a row → health drops once.
- Deploy, then check in from two devices on the same day → second one refuses.
- Push only works from the iOS home-screen icon, never a Safari tab.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
