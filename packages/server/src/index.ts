import express from 'express';
import { createServer } from 'http';
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

const server = createServer(app);
createWsHub(server);

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
server.listen(PORT, () => {
  console.log(`\nLSD2 server listening on http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws?sessionId=default&role=capturer|presenter\n`);
});
