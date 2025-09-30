import { Router } from 'express';
import { getBooks, getBookById, getRecommendations } from './book.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();


// Primary API-prefixed routes
router.get('/api/books', getBooks);
router.get('/api/books/:id', getBookById);

// Backwards-compatible alias routes (without /api prefix) to avoid 404s if frontend/baseURL missing /api
router.get('/books', getBooks);
router.get('/books/:id', getBookById);
router.get('/api/recommendations', authenticate, getRecommendations);
router.get('/recommendations', authenticate, getRecommendations);

export default router;
