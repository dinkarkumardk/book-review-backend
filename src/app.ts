import express from 'express';
import cors from 'cors';
import userRoutes from './modules/user/user.routes';
import bookRoutes from './modules/book/book.routes';
import reviewRoutes from './modules/review/review.routes';

const app = express();

const allowedOrigins = new Set(
  Array.from({ length: 13 }, (_, i) => 5173 + i).map(p => `http://localhost:${p}`)
);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
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

export default app;