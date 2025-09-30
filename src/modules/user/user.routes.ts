import { Router } from 'express';
import { registerUser, loginUser, getUserProfile, toggleFavorite, logoutUser, listFavorites, listUserReviews } from './user.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();


router.post('/api/auth/signup', registerUser);
router.post('/api/auth/login', loginUser);
router.post('/api/auth/logout', authenticate, logoutUser);
// Return current authenticated user (alias of profile for frontend /auth/me expectation)
router.get('/api/auth/me', authenticate, getUserProfile);
router.get('/api/profile', authenticate, getUserProfile);
router.post('/api/profile/favorites', authenticate, toggleFavorite);
router.get('/api/profile/favorites', authenticate, listFavorites);
router.get('/api/profile/reviews', authenticate, listUserReviews);

// Alias routes without /api prefix
router.post('/auth/signup', registerUser);
router.post('/auth/login', loginUser);
router.post('/auth/logout', authenticate, logoutUser);
router.get('/auth/me', authenticate, getUserProfile);
router.get('/profile', authenticate, getUserProfile);
router.post('/profile/favorites', authenticate, toggleFavorite);
router.get('/profile/favorites', authenticate, listFavorites);
router.get('/profile/reviews', authenticate, listUserReviews);

export default router;
