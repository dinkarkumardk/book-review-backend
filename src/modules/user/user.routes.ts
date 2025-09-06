import { Router } from 'express';
import { registerUser, loginUser, getUserProfile, toggleFavorite } from './user.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();


router.post('/api/auth/signup', registerUser);
router.post('/api/auth/login', loginUser);
router.get('/api/profile', authenticate, getUserProfile);
router.post('/api/profile/favorites', authenticate, toggleFavorite);

export default router;
