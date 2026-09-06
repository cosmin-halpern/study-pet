'use client';
import { useState, useTransition } from 'react';
import { checkIn } from '@/app/actions';
import { SPECIES, speciesOf, lvOf, type SpeciesId } from '@/lib/creatures';
import { Banner } from './Banner';

type CheckInResult = {
  ok: boolean;
  reason?: string;
  caught?: boolean;
  shiny?: boolean;
  days?: number;
};

export function CheckIn({
  disabled,
  caughtIds,
}: {
  disabled: boolean;
  caughtIds: SpeciesId[];
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<SpeciesId | null>(null);
  const [result, setResult] = useState<(CheckInResult & { species: SpeciesId }) | null>(null);

  function submit() {
    if (!selected) return;
    const species = selected;
    setResult(null);
    startTransition(async () => {
      const r = (await checkIn(species)) as CheckInResult;
      setResult({ ...r, species });
    });
  }

  // "Caught Sprig!" on a new catch, "Cedar!" on an evolution — quiet
  // day-to-day feeding doesn't flash, only the moments worth celebrating.
  const bannerMessage = (() => {
    if (!result?.ok || result.days === undefined) return null;
    const sp = speciesOf(result.species);
    if (result.caught) return result.shiny ? `✨ Shiny ${sp.names[0]}!` : `Caught ${sp.names[0]}!`;
    const prevLevel = lvOf(result.days - 1);
    const newLevel = lvOf(result.days);
    return newLevel > prevLevel ? `${sp.names[newLevel]}!` : null;
  })();

  const buttonLabel = disabled
    ? 'Already checked in today'
    : pending
      ? '…'
      : selected
        ? `Check in for ${speciesOf(selected).stage}`
        : 'Pick a subject first';

  return (
    <div className="mt-6 w-full">
      <p className="text-center text-xs font-semibold tracking-wide text-paper/60 uppercase">
        What did you study today?
      </p>

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {SPECIES.map((s) => {
          const isSelected = selected === s.id;
          const caught = caughtIds.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => setSelected(s.id)}
              disabled={disabled || pending}
              className="rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-30"
              style={
                isSelected
                  ? { borderColor: s.hue, backgroundColor: s.hue, color: '#F0F2EE' }
                  : { borderColor: 'rgba(240,242,238,0.35)', color: '#F0F2EE' }
              }
            >
              {s.stage}
              {!caught && ' ?'}
            </button>
          );
        })}
      </div>

      <button
        onClick={submit}
        disabled={disabled || pending || !selected}
        className="mt-3 w-full rounded bg-paper/10 py-3 text-sm font-semibold text-paper/90 transition-colors enabled:hover:bg-gold enabled:hover:text-navy disabled:cursor-not-allowed disabled:opacity-50"
      >
        {buttonLabel}
      </button>

      {result && !result.ok && result.reason !== 'already_checked_in' && (
        <p className="mt-2 text-center text-sm text-paper/70">{result.reason}</p>
      )}
      {result?.ok && (
        <p className="mt-2 text-center text-sm text-paper/70">
          {speciesOf(result.species).stage} — day {result.days}.
        </p>
      )}

      <Banner message={bannerMessage} />
    </div>
  );
}