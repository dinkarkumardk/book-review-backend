import { Router } from 'express';
import { createReview, updateReview, deleteReview } from './review.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.post('/api/books/:bookId/reviews', authenticate, createReview);
router.put('/api/reviews/:reviewId', authenticate, updateReview);
router.delete('/api/reviews/:reviewId', authenticate, deleteReview);

export default router;
