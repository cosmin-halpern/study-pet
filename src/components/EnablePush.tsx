'use client';
import { useState } from 'react';
import { enablePush } from '@/lib/push';

export function EnablePush() {
  const [status, setStatus] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  const [reason, setReason] = useState<string | null>(null);

  async function onClick() {
    setStatus('pending');
    const r = await enablePush();
    if (r.ok) {
      setStatus('done');
    } else {
      setStatus('error');
      setReason(r.reason ?? null);
    }
  }

  if (status === 'done') {
    return <p className="text-center text-xs text-navy/50">Notifications enabled.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={onClick}
        disabled={status === 'pending'}
        className="text-xs text-navy/50 underline decoration-navy/30 underline-offset-2 hover:text-navy disabled:opacity-50"
      >
        {status === 'pending' ? 'Enabling…' : 'Enable 9pm reminders'}
      </button>
      {status === 'error' && <p className="text-xs text-navy/40">{reason ?? 'Could not enable.'}</p>}
    </div>
  );
}