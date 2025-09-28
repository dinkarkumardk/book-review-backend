import request from 'supertest';
import app from '../src/app';
import { PrismaClient } from '../src/generated/prisma';
import { createAuthHeader } from './setup';

const prisma = new PrismaClient();

describe('Review Routes', () => {
  const authHeader = createAuthHeader(1);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/books/:bookId/reviews', () => {
    it('should create a review with auth', async () => {
      const mockReview = {
        id: 1,
        rating: 5,
        text: 'Great!',
        bookId: 1,
        userId: 1,
        createdAt: '2025-09-28T14:38:51.559Z',
        updatedAt: '2025-09-28T14:38:51.559Z',
      };
      
      (prisma.review.create as jest.Mock).mockResolvedValue(mockReview);

      const res = await request(app)
        .post('/api/books/1/reviews')
        .set(authHeader)
        .send({ rating: 5, text: 'Great!' });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });
    
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/books/1/reviews')
        .send({ rating: 5, text: 'Great!' });
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/reviews/:reviewId', () => {
    it('should update a review with auth and ownership', async () => {
      const mockReview = {
        id: 1,
        userId: 1,
        rating: 4,
        text: 'Updated!',
        bookId: 1,
        createdAt: '2025-09-28T14:38:51.559Z',
        updatedAt: '2025-09-28T14:38:51.559Z',
      };
      
      (prisma.review.findUnique as jest.Mock).mockResolvedValue(mockReview);
      (prisma.review.update as jest.Mock).mockResolvedValue(mockReview);

      const res = await request(app)
        .put('/api/reviews/1')
        .set(authHeader)
        .send({ rating: 4, text: 'Updated!' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
    });
    
    it('should require authentication', async () => {
      const res = await request(app)
        .put('/api/reviews/1')
        .send({ rating: 4, text: 'Updated!' });
      expect(res.status).toBe(401);
    });
    
    it('should check ownership', async () => {
      const mockReview = {
        id: 1,
        userId: 2, // Different user
        rating: 4,
        text: 'Updated!',
        bookId: 1,
        createdAt: '2025-09-28T14:38:51.559Z',
        updatedAt: '2025-09-28T14:38:51.559Z',
      };
      
      (prisma.review.findUnique as jest.Mock).mockResolvedValue(mockReview);

      const res = await request(app)
        .put('/api/reviews/1')
        .set(authHeader)
        .send({ rating: 4, text: 'Updated!' });
      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/reviews/:reviewId', () => {
    it('should delete a review with auth and ownership', async () => {
      const mockReview = {
        id: 1,
        userId: 1,
        rating: 4,
        text: 'Review',
        bookId: 1,
        createdAt: '2025-09-28T14:38:51.559Z',
        updatedAt: '2025-09-28T14:38:51.559Z',
      };
      
      (prisma.review.findUnique as jest.Mock).mockResolvedValue(mockReview);
      (prisma.review.delete as jest.Mock).mockResolvedValue(mockReview);

      const res = await request(app)
        .delete('/api/reviews/1')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });
    
    it('should require authentication', async () => {
      const res = await request(app)
        .delete('/api/reviews/1');
      expect(res.status).toBe(401);
    });
    
    it('should check ownership', async () => {
      const mockReview = {
        id: 1,
        userId: 2, // Different user
        rating: 4,
        text: 'Review',
        bookId: 1,
        createdAt: '2025-09-28T14:38:51.559Z',
        updatedAt: '2025-09-28T14:38:51.559Z',
      };
      
      (prisma.review.findUnique as jest.Mock).mockResolvedValue(mockReview);

      const res = await request(app)
        .delete('/api/reviews/1')
        .set(authHeader);
      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
    });
  });
});
