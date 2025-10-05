import request from 'supertest';
import app from '../src/app';
import { PrismaClient } from '@prisma/client';
import { createValidToken } from './setup';

const prisma = new PrismaClient();

describe('User Profile Routes', () => {
  const validToken = createValidToken(1);

  const mockUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    reviews: [
      {
        id: 1,
        rating: 4,
        text: 'Great book!',
        createdAt: '2025-09-28T14:38:51.566Z',
        book: {
          id: 1,
          title: 'Test Book',
          author: 'Test Author'
        }
      }
    ],
    favorites: [
      {
        id: 1,
        book: {
          id: 1,
          title: 'Favorite Book',
          author: 'Favorite Author'
        }
      }
    ]
  };

  const mockBook = {
    id: 1,
    title: 'Test Book',
    author: 'Test Author',
    description: 'Test Description',
  coverImageURL: 'cover.jpg',
    avgRating: 4.5,
    reviewCount: 10
  };

  describe('GET /api/profile', () => {
    it('should return user profile with reviews and favorites', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          name: true,
          email: true,
          reviews: {
            include: {
              book: {
                select: { id: true, title: true }
              }
            }
          },
          favorites: {
            include: {
              book: {
                select: { id: true, title: true }
              }
            }
          }
        }
      });
    });

    it('should return 401 for unauthenticated user', async () => {
      const response = await request(app)
        .get('/api/profile')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized: No token provided.');
    });

    it('should return 404 for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(response.body.error).toBe('User not found.');
    });

    it('should handle database errors', async () => {
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch profile.');
    });
  });

  describe('POST /api/profile/favorites', () => {
    it('should add a book to favorites', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(null); // Not already favorited
      (prisma.favorite.create as jest.Mock).mockResolvedValue({
        id: 1,
        userId: 1,
        bookId: 1
      });

      const response = await request(app)
        .post('/api/profile/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ bookId: 1 })
        .expect(200);

      expect(response.body.message).toBe('Book added to favorites.');
      expect(prisma.favorite.create).toHaveBeenCalledWith({
        data: { userId: 1, bookId: 1 }
      });
    });

    it('should remove a book from favorites if already favorited', async () => {
      const existingFavorite = { id: 1, userId: 1, bookId: 1 };
      (prisma.favorite.findUnique as jest.Mock).mockResolvedValue(existingFavorite);
      (prisma.favorite.delete as jest.Mock).mockResolvedValue(existingFavorite);

      const response = await request(app)
        .post('/api/profile/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ bookId: 1 })
        .expect(200);

      expect(response.body.message).toBe('Book removed from favorites.');
      expect(prisma.favorite.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      });
    });

    it('should return 401 for unauthenticated user', async () => {
      const response = await request(app)
        .post('/api/profile/favorites')
        .send({ bookId: 1 })
        .expect(401);

      expect(response.body.error).toBe('Unauthorized: No token provided.');
    });

    it('should return 400 for missing bookId', async () => {
      const response = await request(app)
        .post('/api/profile/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Book ID required.');
    });

    it('should handle database errors', async () => {
      (prisma.favorite.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/profile/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ bookId: 1 })
        .expect(500);

      expect(response.body.error).toBe('Failed to toggle favorite.');
    });
  });

  describe('GET /api/profile/favorites', () => {
    const mockFavoriteBooks = [
      {
        id: 1,
        userId: 1,
        bookId: 1,
        book: mockBook
      }
    ];

    it('should return user favorite books', async () => {
      (prisma.favorite.findMany as jest.Mock).mockResolvedValue(mockFavoriteBooks);

      const response = await request(app)
        .get('/api/profile/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toEqual([mockBook]);
      expect(prisma.favorite.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        include: { book: true },
        orderBy: { id: 'desc' }
      });
    });

    it('should return 401 for unauthenticated user', async () => {
      const response = await request(app)
        .get('/api/profile/favorites')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized: No token provided.');
    });

    it('should handle database errors', async () => {
      (prisma.favorite.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/profile/favorites')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch favorites.');
    });
  });

  describe('GET /api/profile/reviews', () => {
    const mockUserReviews = [
      {
        id: 1,
        rating: 4,
        text: 'Great book!',
        createdAt: '2025-09-28T14:38:51.567Z',
        book: {
          id: 1,
          title: 'Test Book',
          author: 'Test Author'
        }
      }
    ];

    it('should return user reviews', async () => {
      (prisma.review.findMany as jest.Mock).mockResolvedValue(mockUserReviews);

      const response = await request(app)
        .get('/api/profile/reviews')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toEqual(mockUserReviews);
      expect(prisma.review.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        include: { book: { select: { id: true, title: true, author: true } } },
        orderBy: { createdAt: 'desc' }
      });
    });

    it('should return 401 for unauthenticated user', async () => {
      const response = await request(app)
        .get('/api/profile/reviews')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized: No token provided.');
    });

    it('should handle database errors', async () => {
      (prisma.review.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/profile/reviews')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch user reviews.');
    });
  });
});