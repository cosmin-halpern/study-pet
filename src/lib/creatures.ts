// Pure functions of level and mood. No React, no Supabase — the cron job
// can import MOODS/moodOf to phrase a notification without dragging React
// in, and evolution thresholds are unit-testable without a database.

export const SPECIES = [
  { id: 'js', stage: 'Advanced JS', names: ['Sprig', 'Sapling', 'Cedar'], hue: '#5C9E6E' },
  { id: 'fe', stage: 'Frontend', names: ['Panel', 'Frame', 'Atrium'], hue: '#4E7FA8' },
  { id: 'ai', stage: 'AI Engineer', names: ['Wisp', 'Ember', 'Beacon'], hue: '#8E6BAE' },
  { id: 'be', stage: 'Backend', names: ['Stax', 'Vault', 'Bedrock'], hue: '#A8763A' },
  { id: 'alg', stage: 'Algorithms', names: ['Loop', 'Spiral', 'Helix'], hue: '#BF6450' },
] as const;

export type SpeciesId = (typeof SPECIES)[number]['id'];

export const THRESH = [0, 10, 30] as const;
export const lvOf = (d: number) => (d >= 30 ? 2 : d >= 10 ? 1 : 0);

export function speciesOf(id: SpeciesId) {
  return SPECIES.find((s) => s.id === id)!;
}

// ---------- mood ----------
// Four face states, in order from healthiest to "the pet has faded."
export const MOODS = ['happy', 'flat', 'sad', 'x'] as const;
export type Mood = (typeof MOODS)[number];

export function moodOf(health: number): Mood {
  if (health <= 0) return 'x';
  if (health < 30) return 'sad';
  if (health < 70) return 'flat';
  return 'happy';
}

// Species keep their own hue while healthy; a fully faded pet goes grey
// regardless of species, so "gone" reads the same across the roster. Also
// used for uncaught roster slots, which are "nothing here yet," not fading.
export const FADE_HUE = '#9AA1A6';
export function colorOf(hue: string, health: number): string {
  return health <= 0 ? FADE_HUE : hue;
}

// One line + a blurb per mood, shown above the health bar. Kept in the
// "recoverable rather than punishing" tone CLAUDE.md asks for — even "gone
// quiet" reads as fixable, not as a failure state.
export const MOOD_COPY: Record<Mood, { label: string; blurb: string }> = {
  happy: { label: 'Thriving.', blurb: 'You have been showing up. Keep the run going.' },
  flat: { label: 'Holding on.', blurb: 'A check-in today keeps things steady.' },
  sad: { label: 'Fading.', blurb: "It's been a few days. One check-in turns this around." },
  x: { label: 'Gone quiet.', blurb: 'No check-ins logged. Come back whenever — nothing here resets.' },
};

// ---------- face ----------
// Drawn in code, not in the art, because it changes independently of the
// body: happy/flat/sad expressions, plus X eyes when a pet has faded.
// eyeY/mouthY/spread let each species' ART position the face on its own
// head — lower the numbers if a creature's head sits higher on the canvas.
function face(kind: Mood, eyeY: number, spread: number, mouthY: number): string {
  const ex1 = 50 - spread / 2;
  const ex2 = 50 + spread / 2;
  const eyes =
    kind === 'x'
      ? [ex1, ex2]
          .map(
            (x) =>
              `<path d="M${x - 2.6} ${eyeY - 2.6} L${x + 2.6} ${eyeY + 2.6} M${x - 2.6} ${eyeY + 2.6} L${x + 2.6} ${eyeY - 2.6}" stroke="#16283C" stroke-width="1.6" stroke-linecap="round"/>`
          )
          .join('')
      : [ex1, ex2].map((x) => `<circle cx="${x}" cy="${eyeY}" r="2.6" fill="#16283C"/>`).join('');

  const half = spread / 2;
  const mouth =
    kind === 'happy'
      ? `<path d="M${50 - half} ${mouthY} Q50 ${mouthY + 6} ${50 + half} ${mouthY}" stroke="#16283C" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
      : kind === 'sad'
        ? `<path d="M${50 - half} ${mouthY + 4} Q50 ${mouthY - 3} ${50 + half} ${mouthY + 4}" stroke="#16283C" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
        : `<line x1="${50 - half * 0.8}" y1="${mouthY}" x2="${50 + half * 0.8}" y2="${mouthY}" stroke="#16283C" stroke-width="1.6" stroke-linecap="round"/>`; // flat and x share a flat mouth

  return eyes + mouth;
}

// The ground shadow every creature sits on. Drawn by code so art never
// needs its own — a second shadow is the most common mistake porting art in.
const SHADOW = `<ellipse cx="50" cy="90" rx="22" ry="4.5" fill="#16283C" opacity=".12"/>`;

// ---------- art ----------
// PLACEHOLDER GEOMETRY. Nothing here is final art — these are stand-ins
// built to the same rules real Linearity Curve exports have to follow, so
// swapping one out later is a straight paste, not a rewrite:
//   - single fill (var(--mood)), no gradients
//   - face area left empty; face() draws it
//   - no shadow of their own (SHADOW above covers it)
//   - contained inside the 100x100 safe zone
//   - additive per level: level 2 adds to level 1, never replaces it
//   - silhouette-distinct per species: leafy / boxy / orbiting / stacked / coiled
type ArtFn = (lv: number, f: Mood) => string;

export const ART: Record<SpeciesId, ArtFn> = {
  js(lv, f) {
    let p = SHADOW;
    p += `<path d="M38 78 L62 78 L58 90 L42 90 Z" fill="var(--mood)"/>`; // pot
    p += `<circle cx="50" cy="58" r="20" fill="var(--mood)"/>`; // leafy body
    if (lv >= 1) p += `<path d="M50 40 Q38 22 26 27 Q33 42 50 40 Z" fill="var(--mood)"/>`; // leaf
    if (lv >= 2) p += `<path d="M50 40 Q62 18 76 23 Q68 40 50 40 Z" fill="var(--mood)"/>`; // second leaf
    p += `<ellipse cx="43" cy="52" rx="7" ry="5" fill="#fff" opacity=".17"/>`;
    return p + face(f, 56, 16, 66);
  },

  fe(lv, f) {
    let p = SHADOW;
    p += `<rect x="30" y="36" width="40" height="40" rx="5" fill="var(--mood)"/>`; // panel body
    if (lv >= 1) p += `<rect x="20" y="44" width="8" height="22" rx="2" fill="var(--mood)"/>`; // left ear
    if (lv >= 1) p += `<rect x="72" y="44" width="8" height="22" rx="2" fill="var(--mood)"/>`; // right ear
    if (lv >= 2) p += `<rect x="36" y="23" width="28" height="10" rx="2" fill="var(--mood)"/>`; // top bar
    p += `<rect x="36" y="43" width="14" height="10" rx="2" fill="#fff" opacity=".17"/>`;
    return p + face(f, 54, 18, 66);
  },

  ai(lv, f) {
    let p = SHADOW;
    p += `<circle cx="50" cy="55" r="16" fill="var(--mood)"/>`; // floating orb
    if (lv >= 1)
      p += `<circle cx="50" cy="55" r="27" fill="none" stroke="var(--mood)" stroke-width="3"/>`; // orbit ring
    if (lv >= 2) p += `<circle cx="76" cy="42" r="4.5" fill="var(--mood)"/>`; // orbiting mote
    p += `<ellipse cx="45" cy="50" rx="6" ry="4" fill="#fff" opacity=".17"/>`;
    return p + face(f, 52, 16, 62);
  },

  be(lv, f) {
    // equal-width, sharp-cornered crates — narrowing toward the top reads
    // as a poop emoji, not a vault. Seam lines keep it reading as separate
    // stacked blocks rather than one tapering blob.
    let p = SHADOW;
    p += `<rect x="28" y="60" width="44" height="22" fill="var(--mood)"/>`; // base crate
    p += `<rect x="28" y="70" width="44" height="1.5" fill="#16283C" opacity=".25"/>`;
    if (lv >= 1) {
      p += `<rect x="28" y="38" width="44" height="22" fill="var(--mood)"/>`; // second crate
      p += `<rect x="28" y="59" width="44" height="1.5" fill="#16283C" opacity=".25"/>`;
      p += `<rect x="28" y="48" width="44" height="1.5" fill="#16283C" opacity=".25"/>`;
    }
    if (lv >= 2) {
      p += `<rect x="28" y="16" width="44" height="22" fill="var(--mood)"/>`; // third crate
      p += `<rect x="28" y="37" width="44" height="1.5" fill="#16283C" opacity=".25"/>`;
      p += `<rect x="28" y="26" width="44" height="1.5" fill="#16283C" opacity=".25"/>`;
    }
    p += `<rect x="33" y="64" width="14" height="8" fill="#fff" opacity=".17"/>`;
    return p + face(f, 71, 18, 82); // face stays on the base crate at every level
  },

  alg(lv, f) {
    let p = SHADOW;
    p += `<path d="M50 82 C32 82 32 62 46 60 C34 58 36 40 52 38" stroke="var(--mood)" stroke-width="11" stroke-linecap="round" fill="none"/>`; // base coil
    if (lv >= 1)
      p += `<path d="M52 38 C66 38 66 22 52 20" stroke="var(--mood)" stroke-width="9" stroke-linecap="round" fill="none"/>`; // tighter inner coil
    if (lv >= 2) p += `<circle cx="52" cy="17" r="4.5" fill="var(--mood)"/>`; // coil tip
    p += `<ellipse cx="44" cy="64" rx="6" ry="4" fill="#fff" opacity=".17"/>`;
    return p + face(f, 68, 16, 80);
  },
};