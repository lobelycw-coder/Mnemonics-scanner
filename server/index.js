// server/index.js
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';

const app = Fastify({ logger: true });
await app.register(websocket);
await app.register(fastifyStatic, { root: join(__dirname, '../public') });

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
await app.listen({ port, host });
const clients = new Set();

app.get('/ws', { websocket: true }, (socket) => {
  clients.add(socket);
  socket.on('close', () => clients.delete(socket));
  socket.send(JSON.stringify({ type: 'snapshot', ...scanner.state() }));
});

const broadcast = (msg) => {
  const raw = JSON.stringify(msg);
  for (const c of clients) if (c.readyState === 1) c.send(raw);
};

scanner.on('scan', (e) => broadcast({ type: 'scan', ...e }));
scanner.on('hit', (e) => broadcast({ type: 'hit', ...e }));