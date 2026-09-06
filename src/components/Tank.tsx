import { Pet } from './Pet';
import { speciesOf, lvOf, moodOf, colorOf, MOOD_COPY, THRESH, type SpeciesId } from '@/lib/creatures';

// Diffs two Postgres-sourced date strings (today, last_check) — never the
// client clock. Per CLAUDE.md rule #1, "today" itself always comes from
// user_today() and nowhere else; this only labels the gap between two dates
// that already came from there.
function daysAgo(today: string, lastCheck: string | null): number | null {
  if (!lastCheck) return null;
  return Math.round((Date.parse(today) - Date.parse(lastCheck)) / 86_400_000);
}

function lastSeenLabel(today: string, lastCheck: string | null): string {
  const gap = daysAgo(today, lastCheck);
  if (gap === null) return 'never checked in';
  if (gap === 0) return 'checked in today';
  if (gap === 1) return 'last seen yesterday';
  return `last seen ${gap} days ago`;
}

export function Tank({
  activeId,
  days,
  health,
  today,
  lastCheck,
  children,
}: {
  activeId: SpeciesId;
  days: number;
  health: number;
  today: string;
  lastCheck: string | null;
  children?: React.ReactNode;
}) {
  const species = speciesOf(activeId);
  const level = lvOf(days);
  const mood = moodOf(health);
  const color = colorOf(species.hue, health);
  const copy = MOOD_COPY[mood];

  const next = level < 2 ? THRESH[level + 1] : null;
  const nextName = level < 2 ? species.names[level + 1] : null;

  return (
    <div className="w-full rounded-lg bg-navy px-6 py-8 text-paper">
      <p className="text-center text-xs font-semibold tracking-[0.2em] text-gold uppercase">
        {species.names[level]}
      </p>
      <p className="mt-1 text-center text-sm italic text-paper/60">
        {species.stage} · {days} day{days === 1 ? '' : 's'} logged
      </p>

      <div className="mt-4 flex justify-center">
        <Pet species={activeId} level={level} face={mood} color={color} />
      </div>

      <p className="mt-2 text-center font-display text-xl italic">{copy.label}</p>
      <p className="mt-1 text-center text-sm text-paper/70">{copy.blurb}</p>

      <div className="mt-6 flex justify-between text-xs text-paper/60">
        <span>{health} health</span>
        <span>{lastSeenLabel(today, lastCheck)}</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-paper/15">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(0, Math.min(100, health))}%`, backgroundColor: color }}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-1">
        {[0, 1, 2].map((i) => {
          const lo = i === 0 ? 0 : THRESH[i];
          const hi = i === 2 ? THRESH[2] : THRESH[i + 1];
          const fill =
            level > i ? 1 : level < i ? 0 : Math.max(0, Math.min(1, (days - lo) / (hi - lo)));
          return (
            <div key={i} className="h-1.5 overflow-hidden rounded-full bg-paper/15">
              <div
                className="h-full rounded-full bg-gold transition-all"
                style={{ width: `${fill * 100}%` }}
              />
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-center text-xs text-paper/60">
        {next !== null
          ? `${next - days} more ${species.stage} day${next - days === 1 ? '' : 's'} to ${nextName}`
          : 'Fully grown.'}
      </p>

      {children}
    </div>
  );
}