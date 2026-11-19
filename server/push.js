import webpush from 'web-push';
import { store } from '../core/store.js';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

let lastSent = 0;

export function subscribe(sub) {
  store.saveSub(sub.endpoint, JSON.stringify(sub.keys));
}

export function unsubscribe(endpoint) {
  store.removeSub(endpoint);
}

/** Fire-and-forget; prunes dead endpoints. */
export async function notifyHit({ address, mnemonic, balance }) {
  const now = Date.now();
  if (now - lastSent < 4000) return;   // collapse bursts
  lastSent = now;

  const payload = JSON.stringify({
    title: `Hit — ${balance} ETH`,
    body: `${address.slice(0, 10)}…${address.slice(-6)}`,
    address,
    mnemonic,
    tag: 'hit',
  });

  await Promise.allSettled(
    store.subs().map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: JSON.parse(s.keys) },
          payload,
          { TTL: 3600 },
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) store.removeSub(s.endpoint);
      }
    }),
  );
}