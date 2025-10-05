import request from 'supertest';
import app from '../src/app';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

describe('Review Routes', () => {
  const validToken = jwt.sign(
    { userId: 1, email: 'test@example.com' },
    process.env.JWT_SECRET || 'your_jwt_secret'
  );

    const mockReview = {
    id: 1,
    rating: 4,
    text: 'Great book!',
    bookId: 1,
    userId: 1,
    createdAt: '2025-09-28T14:38:51.559Z',
    updatedAt: '2025-09-28T14:38:51.559Z',
  };

  const mockReviews = [
    {
      id: 1,
      rating: 4,
      text: 'Great book!',
      bookId: 1,
      userId: 1,
      createdAt: '2025-09-28T14:38:51.559Z',
      updatedAt: '2025-09-28T14:38:51.559Z',
      user: { id: 1, name: 'Test User' },
    },
  ];

  const mockReviewWithUser = {
    id: 1,
    rating: 4,
    text: 'Great book!',
    bookId: 1,
    userId: 1,
    createdAt: '2025-09-28T14:38:51.559Z',
    updatedAt: '2025-09-28T14:38:51.559Z',
    user: { id: 1, name: 'Test User' },
  };  describe('POST /api/books/:bookId/reviews', () => {
    const reviewData = {
      rating: 4,
      text: 'This is a great book!'
    };

    it('should create a new review successfully', async () => {
      (prisma.review.findFirst as jest.Mock).mockResolvedValue(null); // No existing review
      (prisma.review.create as jest.Mock).mockResolvedValue(mockReview);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback(prisma);
      });
      (prisma.review.findMany as jest.Mock).mockResolvedValue([mockReview]);
      (prisma.book.update as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/api/books/1/reviews')
        .set('Authorization', `Bearer ${validToken}`)
        .send(reviewData)
        .expect(201);

      expect(response.body).toEqual(mockReview);
      expect(prisma.review.create).toHaveBeenCalledWith({
        data: {
          rating: reviewData.rating,
          text: reviewData.text,
          userId: 1,
          bookId: 1,
        },
      });
    });

    it('should return 401 for unauthenticated user', async () => {
      const response = await request(app)
        .post('/api/books/1/reviews')
        .send(reviewData)
        .expect(401);

      expect(response.body.error).toBe('Unauthorized: No token provided.');
    });

    it('should return 400 for missing rating', async () => {
      const response = await request(app)
        .post('/api/books/1/reviews')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ text: 'Great book!' })
        .expect(400);

      expect(response.body.error).toBe('Rating and text required.');
    });

    it('should return 400 for invalid rating', async () => {
      const response = await request(app)
        .post('/api/books/1/reviews')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ rating: 6, text: 'Great book!' })
        .expect(400);

      expect(response.body.error).toBe('Rating must be between 1 and 5.');
    });

    it('should return 409 for duplicate review', async () => {
      (prisma.review.findFirst as jest.Mock).mockResolvedValue(mockReview);

      const response = await request(app)
        .post('/api/books/1/reviews')
        .set('Authorization', `Bearer ${validToken}`)
        .send(reviewData)
        .expect(409);

      expect(response.body.error).toBe('User has already reviewed this book.');
    });

    it('should handle database errors', async () => {
      (prisma.review.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.review.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/books/1/reviews')
        .set('Authorization', `Bearer ${validToken}`)
        .send(reviewData)
        .expect(500);

      expect(response.body.error).toBe('Failed to create review.');
    });
  });

  describe('GET /api/books/:bookId/reviews', () => {
    it('should return reviews for a book', async () => {
      const mockReviews = [mockReviewWithUser];
      (prisma.review.findMany as jest.Mock).mockResolvedValue(mockReviews);

      const response = await request(app)
        .get('/api/books/1/reviews')
        .expect(200);

      expect(response.body).toEqual(mockReviews);
      expect(prisma.review.findMany).toHaveBeenCalledWith({
        where: { bookId: 1 },
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true } },
        },
      });
    });

    it('should handle database errors', async () => {
      (prisma.review.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/books/1/reviews')
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch reviews.');
    });
  });

  describe('GET /api/reviews/:reviewId', () => {
    it('should return a specific review', async () => {
      (prisma.review.findUnique as jest.Mock).mockResolvedValue(mockReviewWithUser);

      const response = await request(app)
        .get('/api/reviews/1')
        .expect(200);

      expect(response.body).toEqual(mockReviewWithUser);
      expect(prisma.review.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { user: { select: { id: true, name: true } } },
      });
    });

    it('should return 404 for non-existent review', async () => {
      (prisma.review.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/reviews/999')
        .expect(404);

      expect(response.body.error).toBe('Review not found.');
    });
  });

  describe('PUT /api/reviews/:reviewId', () => {
    const updateData = {
      rating: 5,
      text: 'Updated review text'
    };

    it('should update a review successfully', async () => {
      const updatedReview = { ...mockReview, ...updateData };
      
      (prisma.review.findUnique as jest.Mock).mockResolvedValue(mockReview);
      (prisma.review.update as jest.Mock).mockResolvedValue(updatedReview);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback(prisma);
      });
      (prisma.review.findMany as jest.Mock).mockResolvedValue([updatedReview]);
      (prisma.book.update as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .put('/api/reviews/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual(updatedReview);
    });

    it('should return 401 for unauthenticated user', async () => {
      const response = await request(app)
        .put('/api/reviews/1')
        .send(updateData)
        .expect(401);

      expect(response.body.error).toBe('Unauthorized: No token provided.');
    });

    it('should return 404 for non-existent review', async () => {
      (prisma.review.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .put('/api/reviews/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.error).toBe('Review not found.');
    });

    it('should return 403 for unauthorized user', async () => {
      const differentUserReview = { ...mockReview, userId: 2 };
      (prisma.review.findUnique as jest.Mock).mockResolvedValue(differentUserReview);

      const response = await request(app)
        .put('/api/reviews/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.error).toBe('Forbidden: Not review author.');
    });

    it('should return 400 for invalid rating', async () => {
      (prisma.review.findUnique as jest.Mock).mockResolvedValue(mockReview);

      const response = await request(app)
        .put('/api/reviews/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ rating: 0 })
        .expect(400);

      expect(response.body.error).toBe('Rating must be between 1 and 5.');
    });
  });

  describe('DELETE /api/reviews/:reviewId', () => {
    it('should delete a review successfully', async () => {
      (prisma.review.findUnique as jest.Mock).mockResolvedValue(mockReview);
      (prisma.review.delete as jest.Mock).mockResolvedValue(mockReview);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback(prisma);
      });
      (prisma.review.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.book.update as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .delete('/api/reviews/1')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.message).toBe('Review deleted.');
      expect(prisma.review.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should return 401 for unauthenticated user', async () => {
      const response = await request(app)
        .delete('/api/reviews/1')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized: No token provided.');
    });

    it('should return 404 for non-existent review', async () => {
      (prisma.review.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/reviews/1')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(response.body.error).toBe('Review not found.');
    });

    it('should return 403 for unauthorized user', async () => {
      const differentUserReview = { ...mockReview, userId: 2 };
      (prisma.review.findUnique as jest.Mock).mockResolvedValue(differentUserReview);

      const response = await request(app)
        .delete('/api/reviews/1')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);

      expect(response.body.error).toBe('Forbidden: Not review author.');
    });
  });

  describe('GET /api/books/:bookId/reviews/summary', () => {
    it('should return review summary for a book', async () => {
      const mockBook = {
        id: 1,
        avgRating: 4.5,
        reviewCount: 10
      };

      (prisma.book.findUnique as jest.Mock).mockResolvedValue(mockBook);

      const response = await request(app)
        .get('/api/books/1/reviews/summary')
        .expect(200);

      expect(response.body).toEqual({
        bookId: 1,
        avgRating: 4.5,
        reviewCount: 10
      });
    });

    it('should return 404 for non-existent book', async () => {
      (prisma.book.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/books/999/reviews/summary')
        .expect(404);

      expect(response.body.error).toBe('Book not found.');
    });
  });
});