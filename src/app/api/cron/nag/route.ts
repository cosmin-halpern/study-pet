import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { moodOf, MOOD_COPY } from '@/lib/creatures';

// Vercel Hobby caps crons at once/day, so vercel.json fires this once at a
// fixed UTC hour (18:00) rather than hourly with a per-user local-hour
// filter in SQL. That lands at 21:00 in Europe/Bucharest during EEST
// (summer) and 20:00 during EET (winter) — off by an hour half the year,
// and wrong for anyone outside that timezone. Upgrading to Pro (or calling
// this route hourly from an external scheduler like GitHub Actions) would
// restore exact-local-9pm behavior for any timezone.
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('no', { status: 401 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // everyone who hasn't logged today, in their own timezone
  const { data: due } = await sb.rpc('users_needing_nag');

  for (const row of due ?? []) {
    const { data: subs } = await sb.from('push_subs').select('*').eq('user_id', row.user_id);

    const copy = MOOD_COPY[moodOf(row.health)];

    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({
            title: copy.label,
            body: `${copy.blurb} (${row.streak} day streak, ${row.health} health.)`,
          })
        );
      } catch {
        await sb.from('push_subs').delete().eq('endpoint', s.endpoint);
      }
    }
  }

  return Response.json({ sent: due?.length ?? 0 });
}