'use client';
import { useTransition } from 'react';
import { saveActive } from '@/app/actions';
import { Pet } from './Pet';
import { SPECIES, lvOf, colorOf, FADE_HUE, type SpeciesId } from '@/lib/creatures';

type CaughtPet = { species: SpeciesId; days: number };

export function Roster({
  activeId,
  pets,
  health,
}: {
  activeId: SpeciesId;
  pets: CaughtPet[];
  health: number;
}) {
  const [pending, startTransition] = useTransition();
  const byId = new Map(pets.map((p) => [p.species, p]));

  return (
    <section className="w-full">
      <h2 className="font-display text-2xl">Your roster</h2>
      <p className="mt-1 text-sm text-navy/60">
        Tap one to bring it out. Greyed slots haven&apos;t been caught yet.
      </p>

      <div className="mt-3 grid grid-cols-5 gap-2">
        {SPECIES.map((s) => {
          const pet = byId.get(s.id);
          const caught = !!pet;
          const isActive = s.id === activeId;
          const level = caught ? lvOf(pet.days) : 0;
          const color = caught ? colorOf(s.hue, isActive ? health : 100) : FADE_HUE;

          return (
            <button
              key={s.id}
              disabled={!caught || pending}
              onClick={() => startTransition(() => void saveActive(s.id))}
              className={`flex flex-col items-center gap-1 rounded border p-2 text-center transition-colors disabled:cursor-default ${
                isActive ? 'border-gold bg-gold/10' : 'border-navy/15'
              }`}
            >
              <Pet species={s.id} level={level} face={caught ? 'happy' : 'flat'} color={color} size={44} />
              <span className="text-xs font-medium">{caught ? s.names[level] : '???'}</span>
              <span className="text-[10px] text-navy/50">
                {caught ? `${pet.days} day${pet.days === 1 ? '' : 's'}` : s.stage}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}