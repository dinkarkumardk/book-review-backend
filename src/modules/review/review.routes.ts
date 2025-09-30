import { Router } from 'express';
import { createReview, updateReview, deleteReview, getBookReviews, getReview, getBookReviewSummary } from './review.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.get('/api/books/:bookId/reviews', getBookReviews);
router.get('/api/books/:bookId/reviews/summary', getBookReviewSummary);
router.get('/api/reviews/:reviewId', getReview);
router.post('/api/books/:bookId/reviews', authenticate, createReview);
router.put('/api/reviews/:reviewId', authenticate, updateReview);
router.delete('/api/reviews/:reviewId', authenticate, deleteReview);

// Alias non-/api prefixed routes
router.get('/books/:bookId/reviews', getBookReviews);
router.get('/books/:bookId/reviews/summary', getBookReviewSummary);
router.get('/reviews/:reviewId', getReview);
router.post('/books/:bookId/reviews', authenticate, createReview);
router.put('/reviews/:reviewId', authenticate, updateReview);
router.delete('/reviews/:reviewId', authenticate, deleteReview);

export default router;
