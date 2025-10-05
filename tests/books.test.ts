import request from 'supertest';
import app from '../src/app';
import { PrismaClient } from '@prisma/client';
import { createValidToken } from './setup';

const prisma = new PrismaClient();

describe('Book Routes', () => {
  const mockBooks = [
    {
      id: 1,
      title: 'Test Book 1',
      author: 'Author 1',
      description: 'Description 1',
  coverImageURL: 'cover1.jpg',
      avgRating: 4.5,
      reviewCount: 10,
      publishedYear: 2023
    },
    {
      id: 2,
      title: 'Test Book 2',
      author: 'Author 2',
      description: 'Description 2',
  coverImageURL: 'cover2.jpg',
      avgRating: 3.8,
      reviewCount: 5,
      publishedYear: 2022
    }
  ];

  describe('GET /api/books', () => {
    it('should return paginated list of books', async () => {
      (prisma.book.findMany as jest.Mock).mockResolvedValue(mockBooks);
      (prisma.book.count as jest.Mock).mockResolvedValue(2);

      const response = await request(app)
        .get('/api/books')
        .expect(200);

      expect(response.body).toEqual(mockBooks);
      expect(prisma.book.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { title: { contains: '', mode: 'insensitive' } },
            { author: { contains: '', mode: 'insensitive' } },
          ],
        },
        skip: 0,
        take: 10,
        orderBy: { title: 'asc' },
      });
    });

    it('should return books with pagination', async () => {
      (prisma.book.findMany as jest.Mock).mockResolvedValue(mockBooks);
      (prisma.book.count as jest.Mock).mockResolvedValue(2);

      const response = await request(app)
        .get('/api/books?page=1&meta=true')
        .expect(200);

      expect(response.body.data).toEqual(mockBooks);
      expect(response.body.page).toBe(1);
      expect(response.body.total).toBe(2);
    });

    it('should return books without meta when meta is not true', async () => {
      (prisma.book.findMany as jest.Mock).mockResolvedValue(mockBooks);
      (prisma.book.count as jest.Mock).mockResolvedValue(2);

      const response = await request(app)
        .get('/api/books?page=1')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toEqual(mockBooks);
    });

    it('should handle page numbers less than 1', async () => {
      (prisma.book.findMany as jest.Mock).mockResolvedValue(mockBooks);
      (prisma.book.count as jest.Mock).mockResolvedValue(2);

      const response = await request(app)
        .get('/api/books?page=0&meta=true')
        .expect(200);

      expect(response.body.page).toBe(1);
    });

    it('should filter books by search query', async () => {
      const searchQuery = 'Harry Potter';
      (prisma.book.findMany as jest.Mock).mockResolvedValue([mockBooks[0]]);
      (prisma.book.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get(`/api/books?search=${encodeURIComponent(searchQuery)}`)
        .expect(200);

      expect(prisma.book.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { title: { contains: searchQuery, mode: 'insensitive' } },
            { author: { contains: searchQuery, mode: 'insensitive' } },
          ],
        },
        skip: 0,
        take: 10,
        orderBy: { title: 'asc' },
      });
    });

    it('should handle pagination correctly', async () => {
      (prisma.book.findMany as jest.Mock).mockResolvedValue(mockBooks);
      (prisma.book.count as jest.Mock).mockResolvedValue(15);

      const response = await request(app)
        .get('/api/books?page=2')
        .expect(200);

      expect(prisma.book.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { title: { contains: '', mode: 'insensitive' } },
            { author: { contains: '', mode: 'insensitive' } },
          ],
        },
        skip: 10, // page 2, skip first 10
        take: 10,
        orderBy: { title: 'asc' },
      });
    });

    it('should handle invalid page numbers', async () => {
      (prisma.book.findMany as jest.Mock).mockResolvedValue(mockBooks);
      (prisma.book.count as jest.Mock).mockResolvedValue(2);

      const response = await request(app)
        .get('/api/books?page=0') // Invalid page
        .expect(200);

      expect(prisma.book.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { title: { contains: '', mode: 'insensitive' } },
            { author: { contains: '', mode: 'insensitive' } },
          ],
        },
        skip: 0, // Should default to page 1
        take: 10,
        orderBy: { title: 'asc' },
      });
    });

    it('should handle database errors', async () => {
      (prisma.book.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/books')
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch books.');
    });
  });

  describe('GET /api/books/search', () => {
    it('should return empty payload if query missing', async () => {
      const response = await request(app)
        .get('/api/books/search')
        .expect(200);

      expect(response.body).toEqual({ data: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
      expect(prisma.book.findMany).not.toHaveBeenCalled();
    });

    it('should search books with pagination and filters', async () => {
      (prisma.book.findMany as jest.Mock).mockResolvedValue([mockBooks[0]]);
      (prisma.book.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/books/search?q=Test&page=2&limit=5&genre=Fantasy&sort=rating&order=desc')
        .expect(200);

      expect(prisma.book.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { title: { contains: 'Test', mode: 'insensitive' } },
            { author: { contains: 'Test', mode: 'insensitive' } },
          ],
          genres: { has: 'Fantasy' },
        },
        skip: 5,
        take: 5,
        orderBy: { avgRating: 'desc' },
      });

      expect(response.body.page).toBe(2);
      expect(response.body.pageSize).toBe(5);
      expect(response.body.total).toBe(1);
    });
  });

  describe('GET /api/books/:id', () => {
    const mockBookWithReviews = {
      ...mockBooks[0],
      reviews: [
        {
          id: 1,
          rating: 5,
          text: 'Great book!',
          userId: 1,
          createdAt: '2025-09-28T14:38:51.552Z'
        }
      ]
    };

    it('should return book by id with reviews', async () => {
      (prisma.book.findUnique as jest.Mock).mockResolvedValue(mockBookWithReviews);

      const response = await request(app)
        .get('/api/books/1')
        .expect(200);

      expect(response.body).toEqual(mockBookWithReviews);
      expect(prisma.book.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { reviews: true },
      });
    });

    it('should return 404 for non-existent book', async () => {
      (prisma.book.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/books/999')
        .expect(404);

      expect(response.body.error).toBe('Book not found.');
    });

    it('should handle database errors', async () => {
      (prisma.book.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/books/1')
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch book.');
    });
  });

  describe('GET /api/recommendations', () => {
    const validToken = createValidToken(1);

    it('should return recommendations for authenticated user', async () => {
      // Mock the necessary Prisma calls for recommendations
      (prisma.favorite.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.book.findMany as jest.Mock).mockResolvedValue(mockBooks);

      const response = await request(app)
        .get('/api/recommendations?limit=10')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(Array.isArray(response.body.recommendations)).toBe(true);
      expect(response.body.mode).toBe('hybrid');
    });

    it('should return 401 for unauthenticated user', async () => {
      const response = await request(app)
        .get('/api/recommendations')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized: No token provided.');
    });

    it('should handle errors in recommendation service', async () => {
      // Mock Prisma to throw error
      (prisma.favorite.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));
      (prisma.book.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/recommendations?limit=11')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch recommendations.');
    });
  });
});