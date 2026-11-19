import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { engine } from '../core/engine.js';
import { store } from '../core/store.js';
import * as push from './push.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = Fastify({ logger: true });
const TOKEN = process.env.APP_TOKEN;

const authed = (req) => !TOKEN || req.query.t === TOKEN || req.headers.authorization === `Bearer ${TOKEN}`;

app.register(websocket);
app.register(fastifyStatic, { root: join(__dirname, '../public'), prefix: '/' });

app.addHook('preHandler', async (req, reply) => {
  if (req.url.startsWith('/api') && !authed(req)) reply.code(401).send({ error: 'unauthorized' });
});

app.get('/api/state', async () => ({ ...engine.snapshot(), hits: store.hits(200) }));
app.get('/api/hits', async () => store.hits(5000));
app.post('/api/start', async () => (engine.start(), engine.snapshot()));
app.post('/api/pause', async () => (engine.pause(), engine.snapshot()));
app.post('/api/stop', async () => (engine.stop(), engine.snapshot()));
app.post('/api/recheck', async () => engine.recheck(200));
app.delete('/api/hits', async () => (store.clearHits(), { ok: true }));

app.get('/api/push/key', async () => ({ key: process.env.VAPID_PUBLIC_KEY }));
app.post('/api/push/subscribe', async (req) => (push.subscribe(req.body), { ok: true }));
app.post('/api/push/unsubscribe', async (req) => (push.unsubscribe(req.body.endpoint), { ok: true }));

const clients = new Set();
const broadcast = (m) => {
  const raw = JSON.stringify(m);
  for (const c of clients) if (c.readyState === 1) c.send(raw);
};

app.get('/ws', { websocket: true }, (socket, req) => {
  if (!authed(req)) return socket.close(1008, 'unauthorized');
  clients.add(socket);
  socket.send(JSON.stringify({ type: 'snapshot', ...engine.snapshot(), hits: store.hits(200) }));
  socket.on('close', () => clients.delete(socket));
});

engine.on('scan', (e) => broadcast({ type: 'scan', ...e }));
engine.on('stats', (s) => broadcast({ type: 'stats', ...s }));
engine.on('state', (s) => broadcast({ type: 'state', state: s }));
engine.on('hit', (e) => { broadcast({ type: 'hit', ...e }); push.notifyHit(e); });

await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });