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

// Root - Landing page
app.get('/', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Belotte Contree Online</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: #0a1a0f;
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      padding: 40px;
    }
    .cards {
      font-size: 64px;
      margin-bottom: 24px;
      letter-spacing: 8px;
    }
    h1 {
      font-size: 42px;
      font-weight: 700;
      background: linear-gradient(135deg, #2ecc71, #f1c40f);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #888;
      font-size: 18px;
      margin-bottom: 40px;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #1a2e1f;
      padding: 12px 24px;
      border-radius: 50px;
      font-size: 16px;
      border: 1px solid #2ecc7133;
      margin-bottom: 32px;
    }
    .dot {
      width: 10px;
      height: 10px;
      background: #2ecc71;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .info {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      max-width: 400px;
      margin: 0 auto;
    }
    .info-card {
      background: #111d14;
      border: 1px solid #ffffff10;
      border-radius: 12px;
      padding: 16px;
    }
    .info-card .label { color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
    .info-card .value { font-size: 20px; font-weight: 600; margin-top: 4px; color: #2ecc71; }
    .download-btn {
      display: inline-block;
      margin-top: 32px;
      padding: 16px 40px;
      background: linear-gradient(135deg, #2ecc71, #27ae60);
      color: #fff;
      text-decoration: none;
      font-size: 18px;
      font-weight: 700;
      border-radius: 50px;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 4px 20px #2ecc7144;
    }
    .download-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 30px #2ecc7166;
    }
    .download-btn .icon { margin-right: 8px; }
    .footer {
      margin-top: 24px;
      color: #555;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="cards">\u2660 \u2665 \u2666 \u2663</div>
    <h1>Belotte Contree</h1>
    <p class="subtitle">Jeu de cartes multijoueur en ligne</p>
    <div class="status">
      <span class="dot"></span>
      Serveur en ligne
    </div>
    <div class="info">
      <div class="info-card">
        <div class="label">API</div>
        <div class="value">REST</div>
      </div>
      <div class="info-card">
        <div class="label">Temps reel</div>
        <div class="value">WebSocket</div>
      </div>
      <div class="info-card">
        <div class="label">Joueurs</div>
        <div class="value">4 / partie</div>
      </div>
      <div class="info-card">
        <div class="label">Version</div>
        <div class="value">1.0.0</div>
      </div>
    </div>
    <a href="https://github.com/AmazingeventParis/Belotte/releases/latest/download/app-release.apk" class="download-btn">
      <span class="icon">\u2B07</span> Telecharger l'APK Android
    </a>
    <p class="footer">Android 5.0+ requis</p>
  </div>
</body>
</html>`);
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
