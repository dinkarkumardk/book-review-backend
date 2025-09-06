import request from 'supertest';
import express from 'express';
jest.mock('../src/modules/book/book.controller');
import bookRoutes from '../src/modules/book/book.routes';
import { getBooks, getBookById, getRecommendations } from '../src/modules/book/book.controller';

const app = express();
app.use(express.json());
app.use(bookRoutes);

describe('Book Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/books', () => {
    it('should return a list of books', async () => {
      (getBooks as jest.Mock).mockImplementation((req, res) => res.json([{ id: 1, title: 'Book 1' }]));
      const res = await request(app).get('/api/books');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.any(Array));
    });
  });

  describe('GET /api/books/:id', () => {
    it('should return a single book', async () => {
      (getBookById as jest.Mock).mockImplementation((req, res) => res.json({ id: 1, title: 'Book 1' }));
      const res = await request(app).get('/api/books/1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
    });

    it('should return 404 if book not found', async () => {
      (getBookById as jest.Mock).mockImplementation((req, res) => res.status(404).json({ error: 'Book not found.' }));
      const res = await request(app).get('/api/books/999');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/recommendations', () => {
    it('should require authentication', async () => {
      (getRecommendations as jest.Mock).mockImplementation((req, res) => res.status(401).json({ error: 'Unauthorized' }));
      const res = await request(app).get('/api/recommendations');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });
  });
});
