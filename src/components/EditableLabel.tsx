'use client';
import { useState, useTransition } from 'react';
import { saveSubjectLabel } from '@/app/actions';
import type { SpeciesId } from '@/lib/creatures';

export function EditableLabel({ species, label }: { species: SpeciesId; label: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const [pending, startTransition] = useTransition();

  function save() {
    setEditing(false);
    const trimmed = value.trim();
    if (!trimmed) {
      setValue(label);
      return;
    }
    if (trimmed === label) return;
    setValue(trimmed);
    startTransition(() => void saveSubjectLabel(species, trimmed));
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setValue(label);
            setEditing(false);
          }
        }}
        className="w-full border-b border-gold/50 bg-transparent text-center italic text-paper outline-none"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      disabled={pending}
      title="Rename this subject"
      className="underline decoration-paper/30 decoration-dotted underline-offset-2 disabled:opacity-50"
    >
      {value}
    </button>
  );
}