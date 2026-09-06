'use client';
import { useEffect, useState } from 'react';

// Self-contained flash: pass a new message string to show it, it fades
// itself out after a couple seconds. No dismiss wiring needed from callers.
export function Banner({ message }: { message: string | null }) {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!message) return;
    setText(message);
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(t);
  }, [message]);

  return (
    <div
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
      }`}
    >
      <div className="rounded-full bg-gold px-5 py-2 font-display text-sm text-navy shadow-md">
        {text}
      </div>
    </div>
  );
}