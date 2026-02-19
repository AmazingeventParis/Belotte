import express from 'express';
import { createServer } from 'http';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { config } from './config/index.js';
import { createToken } from './auth/jwt.js';
import { GameWebSocketServer } from './ws/WebSocketServer.js';
import { logger } from './utils/logger.js';

const prisma = new PrismaClient();
const app = express();
app.use(express.json());

// Root
app.get('/', (_req, res) => {
  res.json({
    name: 'Belotte Contrée API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      guest: 'POST /api/auth/guest',
      websocket: 'WSS /ws',
    },
  });
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// --- Auth Routes ---

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password || username.length < 3 || password.length < 4) {
      return res.status(400).json({ error: 'Username (3+ chars) and password (4+ chars) required' });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, passwordHash },
    });

    const token = createToken({ userId: user.id, username: user.username });
    return res.json({ token, userId: user.id, username: user.username });
  } catch (err) {
    logger.error({ err }, 'Register error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = createToken({ userId: user.id, username: user.username });
    return res.json({ token, userId: user.id, username: user.username });
  } catch (err) {
    logger.error({ err }, 'Login error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/guest', async (_req, res) => {
  try {
    const guestName = `Guest_${uuid().slice(0, 6)}`;
    const passwordHash = await bcrypt.hash(uuid(), 10);

    const user = await prisma.user.create({
      data: { username: guestName, passwordHash, isGuest: true },
    });

    const token = createToken({ userId: user.id, username: user.username });
    return res.json({ token, userId: user.id, username: user.username });
  } catch (err) {
    logger.error({ err }, 'Guest auth error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Start Server ---

const httpServer = createServer(app);
const wsServer = new GameWebSocketServer(httpServer);

httpServer.listen(config.port, () => {
  logger.info({ port: config.port }, `Belotte server running on port ${config.port}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  wsServer.close();
  await prisma.$disconnect();
  process.exit(0);
});
