import { Router } from 'express';
import { getBooks, getBookById, getRecommendations } from './book.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();


router.get('/api/books', getBooks);
router.get('/api/books/:id', getBookById);
router.get('/api/recommendations', authenticate, getRecommendations);

export default router;
