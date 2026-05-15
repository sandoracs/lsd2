import express from 'express';
import { createServer as createHttpsServer } from 'https';
import { generate as generateCert } from 'selfsigned';
import { createWsHub } from './ws-hub.js';
import { healthHandler } from './routes/health.js';
import {
  listSessionsHandler,
  createSessionHandler,
  getSessionHandler,
  deleteSessionHandler,
  updateSessionConfigHandler,
} from './routes/sessions.js';

const app = express();
app.use(express.json());

// Allow all origins in development
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
app.options('*', (_req, res) => { res.status(200).end(); });

app.get('/health', healthHandler);
app.get('/sessions', listSessionsHandler);
app.post('/sessions', createSessionHandler);
app.get('/sessions/:id', getSessionHandler);
app.delete('/sessions/:id', deleteSessionHandler);
app.put('/sessions/:id/config', updateSessionConfigHandler);

const notAfterDate = new Date();
notAfterDate.setFullYear(notAfterDate.getFullYear() + 1);
const pems = await generateCert(
  [{ name: 'commonName', value: 'lsd2.local' }],
  { keySize: 2048, algorithm: 'sha256', notAfterDate },
);

const server = createHttpsServer({ key: pems.private, cert: pems.cert }, app);
createWsHub(server);

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\nLSD2 server listening on https://0.0.0.0:${PORT}`);
  console.log(`WebSocket: wss://localhost:${PORT}/ws?sessionId=default&role=capturer|presenter`);
  console.log(`\nQuest setup: visit https://<your-LAN-IP>:${PORT}/health in Quest Browser`);
  console.log(`and accept the self-signed certificate before using the VR presenter.\n`);
});
