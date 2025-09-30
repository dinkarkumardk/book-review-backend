import express from 'express';
import cors from 'cors';
import userRoutes from './modules/user/user.routes';
import bookRoutes from './modules/book/book.routes';
import reviewRoutes from './modules/review/review.routes';
import { PrismaClient } from '@prisma/client';

const app = express();

// Base allowed local dev origins
const allowedOrigins = new Set(
  Array.from({ length: 13 }, (_, i) => 5173 + i).map(p => `http://localhost:${p}`)
);

// Add dynamic origins from environment variables (comma-separated)
// Supports FRONTEND_URL (single) or ALLOWED_ORIGINS (comma list)
const envAllowed = new Set<string>();
if (process.env.FRONTEND_URL) {
  envAllowed.add(process.env.FRONTEND_URL.trim());
}
if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS.split(',').forEach(o => {
    const trimmed = o.trim();
    if (trimmed) envAllowed.add(trimmed);
  });
}
for (const origin of envAllowed) {
  allowedOrigins.add(origin);
}

if (envAllowed.size) {
  console.log('[CORS] Added dynamic origins:', Array.from(envAllowed));
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow non-browser / curl
    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    console.warn(`[CORS] Blocked origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Body-parsing middleware to populate req.body
app.use(express.json());

// Serve static assets (covers) from public directory
app.use('/covers', express.static('public/covers'));

// Custom logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, `Origin: ${req.headers.origin}`);
  next();
});

// API routes
app.use(userRoutes);
app.use(bookRoutes);
app.use(reviewRoutes);

// Root/health-check route
app.get('/', (req, res) => {
  res.send('BookVerse backend is running!');
});

// Simple health endpoints for deployment checks (no DB) – fast liveness
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', type: 'liveness', uptime: process.uptime(), timestamp: Date.now() });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', type: 'liveness', uptime: process.uptime(), timestamp: Date.now() });
});

// Lazy Prisma client (only when readiness endpoint hit)
let prisma: PrismaClient | null = null;
async function getPrisma() {
  if (!prisma) {
    try {
      prisma = new PrismaClient();
    } catch (e) {
      console.error('[Readiness] Failed to construct PrismaClient', e);
      throw e;
    }
  }
  return prisma;
}

// Readiness endpoint attempts a lightweight DB query
app.get('/ready', async (req, res) => {
  try {
    const client = await getPrisma();
    const now = await client.$queryRaw`SELECT NOW()`;
    res.status(200).json({ status: 'ok', type: 'readiness', db: 'ok', now, timestamp: Date.now() });
  } catch (err) {
    console.error('[Readiness] DB check failed', err);
    res.status(503).json({ status: 'degraded', type: 'readiness', db: 'error', error: (err as Error).message });
  }
});

app.get('/api/ready', async (req, res) => {
  try {
    const client = await getPrisma();
    const now = await client.$queryRaw`SELECT NOW()`;
    res.status(200).json({ status: 'ok', type: 'readiness', db: 'ok', now, timestamp: Date.now() });
  } catch (err) {
    console.error('[Readiness] DB check failed', err);
    res.status(503).json({ status: 'degraded', type: 'readiness', db: 'error', error: (err as Error).message });
  }
});

export default app;