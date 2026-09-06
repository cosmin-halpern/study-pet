import { supabaseBrowser } from './supabase/client';

// Must be called from a user gesture (a button click), never on page load —
// iOS Safari won't grant notification permission from an automatic call.
export async function enablePush() {
  const reg = await navigator.serviceWorker.register('/sw.js');

  if ((await Notification.requestPermission()) !== 'granted') {
    return { ok: false, reason: 'permission denied' };
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  });

  const sb = supabaseBrowser();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, reason: 'not authenticated' };

  const j = sub.toJSON();
  const { error } = await sb
    .from('push_subs')
    .upsert({ user_id: user.id, endpoint: j.endpoint!, p256dh: j.keys!.p256dh, auth: j.keys!.auth });

  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}