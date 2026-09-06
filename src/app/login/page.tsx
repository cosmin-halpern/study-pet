'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  async function send() {
    await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setSent(true);
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-navy/15 bg-white/60 p-8 text-center shadow-sm">
        <h1 className="font-display text-3xl">Study Pets</h1>

        {sent ? (
          <p className="text-navy/80">Check your email for the link.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-navy/70">
              Enter your email and we&apos;ll send you a link to sign in.
            </p>
            <input
              className="w-full rounded border border-navy/30 bg-white p-3 text-navy outline-none focus:border-gold focus:ring-1 focus:ring-gold"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
            />
            <button
              onClick={send}
              disabled={!email}
              className="w-full rounded bg-navy p-3 text-paper transition-colors hover:bg-gold disabled:opacity-40"
            >
              Send magic link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}