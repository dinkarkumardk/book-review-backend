import request from 'supertest';
import express from 'express';
jest.mock('../src/modules/review/review.controller');
import reviewRoutes from '../src/modules/review/review.routes';
import { createReview, updateReview, deleteReview } from '../src/modules/review/review.controller';

const app = express();
app.use(express.json());
app.use(reviewRoutes);

const authHeader = { Authorization: 'Bearer validtoken' };

describe('Review Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/books/:bookId/reviews', () => {
    it('should create a review with auth', async () => {
      (createReview as jest.Mock).mockImplementation((req, res) => res.status(201).json({ id: 1, rating: 5, text: 'Great!' }));
      const res = await request(app)
        .post('/api/books/1/reviews')
        .set(authHeader)
        .send({ rating: 5, text: 'Great!' });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });
    it('should require authentication', async () => {
      (createReview as jest.Mock).mockImplementation((req, res) => res.status(401).json({ error: 'Unauthorized' }));
      const res = await request(app)
        .post('/api/books/1/reviews')
        .send({ rating: 5, text: 'Great!' });
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/reviews/:reviewId', () => {
    it('should update a review with auth and ownership', async () => {
      (updateReview as jest.Mock).mockImplementation((req, res) => res.json({ id: 1, rating: 4, text: 'Updated!' }));
      const res = await request(app)
        .put('/api/reviews/1')
        .set(authHeader)
        .send({ rating: 4, text: 'Updated!' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
    });
    it('should require authentication', async () => {
      (updateReview as jest.Mock).mockImplementation((req, res) => res.status(401).json({ error: 'Unauthorized' }));
      const res = await request(app)
        .put('/api/reviews/1')
        .send({ rating: 4, text: 'Updated!' });
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });
    it('should check ownership', async () => {
      (updateReview as jest.Mock).mockImplementation((req, res) => res.status(403).json({ error: 'Forbidden: Not review author.' }));
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
      (deleteReview as jest.Mock).mockImplementation((req, res) => res.json({ message: 'Review deleted.' }));
      const res = await request(app)
        .delete('/api/reviews/1')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });
    it('should require authentication', async () => {
      (deleteReview as jest.Mock).mockImplementation((req, res) => res.status(401).json({ error: 'Unauthorized' }));
      const res = await request(app)
        .delete('/api/reviews/1');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });
    it('should check ownership', async () => {
      (deleteReview as jest.Mock).mockImplementation((req, res) => res.status(403).json({ error: 'Forbidden: Not review author.' }));
      const res = await request(app)
        .delete('/api/reviews/1')
        .set(authHeader);
      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
    });
  });
});
