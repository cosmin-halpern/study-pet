'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { completeOnboarding } from '@/app/actions';
import { SPECIES, type SpeciesId } from '@/lib/creatures';

export function OnboardingForm({ defaultLabels }: { defaultLabels: Record<SpeciesId, string> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<SpeciesId, string>>(defaultLabels);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await completeOnboarding(values);
      if (!r.ok) {
        setError(r.reason ?? 'Could not save.');
        return;
      }
      router.push('/');
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {SPECIES.map((s) => (
        <div key={s.id} className="flex items-center gap-3">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: s.hue }}
            aria-hidden
          />
          <input
            value={values[s.id]}
            onChange={(e) => setValues((v) => ({ ...v, [s.id]: e.target.value }))}
            placeholder={s.stage}
            className="w-full rounded border border-navy/30 bg-white p-2.5 text-sm text-navy outline-none focus:border-gold focus:ring-1 focus:ring-gold"
          />
        </div>
      ))}

      {error && <p className="text-center text-sm text-navy/60">{error}</p>}

      <button
        onClick={submit}
        disabled={pending}
        className="mt-2 w-full rounded bg-navy p-3 text-sm font-semibold text-paper transition-colors hover:bg-gold disabled:opacity-50"
      >
        {pending ? 'Saving…' : "Let's go"}
      </button>
    </div>
  );
}