import { createTerminal } from './ui/terminal.js';
import { createStats } from './ui/stats.js';

const params = new URLSearchParams(location.search);
if (params.get('t')) { localStorage.setItem('token', params.get('t')); history.replaceState({}, '', '/'); }
const TOKEN = localStorage.getItem('token') ?? '';

const $ = (id) => document.getElementById(id);
const viewport = $('viewport');
const term = createTerminal($('log'), viewport);
const stats = createStats();

let ws, retry = 0, live = false;

function connect() {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?t=${TOKEN}`);

  ws.onopen = () => { retry = 0; live = true; };
  ws.onclose = () => {
    live = false;
    setState('paused');
    setTimeout(connect, Math.min(1000 * 2 ** retry++, 15000));
  };

  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    switch (m.type) {
      case 'snapshot':
        term.clear();
        stats.update(m);
        m.hits?.slice().reverse().forEach((h) => term.push('hit', `HIT ${h.address} ${h.balance} ETH`));
        setState(m.state);
        break;
      case 'scan':
        term.push(m.verified ? (m.balance > 0 ? 'hit' : 'zero') : 'bad',
          m.verified ? `${m.address}  ${m.balance} ETH` : `${m.address}  unverified`);
        break;
      case 'hit':
        $('announce').textContent = `Hit: ${m.balance} ETH — ${m.address}`;
        break;
      case 'stats': stats.update(m); break;
      case 'state': setState(m.state); break;
    }
  };
}

function setState(state) {
  const pill = $('state');
  pill.dataset.state = state;
  pill.querySelector('b').textContent = state.toUpperCase();
  $('toggle').textContent = state === 'running' ? 'Pause' : 'Start';
  $('toggle').dataset.mode = state === 'running' ? 'stop' : 'go';
}

async function api(path, method = 'POST', body) {
  const r = await fetch(path, {
    method,
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.ok ? r.json() : null;
}

$('toggle').onclick = async () => {
}

$('toggle').onclick = async () => {
  const state = $('state').dataset.state;
  await api(state === 'running' ? '/api/pause' : '/api/start');
};

$('recheck').onclick = () => api('/api/recheck');

$('export').onclick = async () => {
  const hits = await (await fetch('/api/hits', { headers: { authorization: `Bearer ${TOKEN}` } })).json();
  const blob = new Blob([JSON.stringify(hits, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `hits-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};

$('jump').onclick = () => { viewport.scrollTop = viewport.scrollHeight; };

// --- push ---
async function enableAlerts() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    $('announce').textContent = 'Install to home screen first, then enable alerts.';
    return;
  }
  const perm = await Notification.requestPermission();   // must be inside the tap
  if (perm !== 'granted') return;

  const { key } = await (await fetch('/api/push/key')).json();
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
  });
  await api('/api/push/subscribe', 'POST', sub.toJSON());
  $('alerts').setAttribute('aria-pressed', 'true');
}

$('alerts').onclick = enableAlerts;

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');

// iOS suspends the socket when backgrounded — resync on return
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && (!ws || ws.readyState > 1)) connect();
});

connect();