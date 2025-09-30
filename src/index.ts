import app from './app';

// Allow overriding port via env while keeping default 3001
const PORT = Number(process.env.PORT) || 3001; // ensure this matches what frontend points to / infra security group

console.log('[Startup] Booting BookVerse backend', {
  nodeEnv: process.env.NODE_ENV,
  port: PORT,
  frontendUrl: process.env.FRONTEND_URL,
  allowedOrigins: process.env.ALLOWED_ORIGINS,
});

app.listen(PORT, () => {
  console.log(`[Startup] Server is listening on port ${PORT}`);
});