import express from 'express';
import userRoutes from './modules/user/user.routes';
import bookRoutes from './modules/book/book.routes';
import reviewRoutes from './modules/review/review.routes';

const app = express();
const PORT = 3001;

// CORS middleware to handle cross-origin requests
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = ['http://localhost:5173', 'http://localhost:5175', 'http://localhost:3000'];
  
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

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

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});