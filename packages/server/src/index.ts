import express from 'express';
import { createServer as createHttpsServer } from 'https';
import { existsSync, readFileSync, writeFileSync } from 'fs';
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

// Cache cert to disk so it survives hot-reloads — clients only need to accept it once
const CERT_CACHE = '/tmp/lsd2-cert.json';

interface CachedPems { private: string; cert: string; }

let pems: CachedPems;
if (existsSync(CERT_CACHE)) {
  pems = JSON.parse(readFileSync(CERT_CACHE, 'utf8')) as CachedPems;
  console.log('Using cached TLS certificate');
} else {
  const notAfterDate = new Date();
  notAfterDate.setFullYear(notAfterDate.getFullYear() + 1);
  const generated = await generateCert(
    [{ name: 'commonName', value: 'lsd2.local' }],
    { keySize: 2048, algorithm: 'sha256', notAfterDate },
  );
  pems = { private: generated.private, cert: generated.cert };
  writeFileSync(CERT_CACHE, JSON.stringify(pems));
  console.log('Generated new TLS certificate (cached to', CERT_CACHE, ')');
}

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

const server = createHttpsServer({ key: pems.private, cert: pems.cert }, app);
createWsHub(server);

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\nLSD2 server listening on https://0.0.0.0:${PORT}`);
  console.log(`WebSocket: wss://localhost:${PORT}/ws?sessionId=default&role=capturer|presenter`);
  console.log(`\nQuest setup: visit https://<your-LAN-IP>:${PORT}/health in Quest Browser`);
  console.log(`and accept the self-signed certificate before using the VR presenter.\n`);
});
