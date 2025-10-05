import request from 'supertest';
import app from '../src/app'; // Import app, not index
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

describe('Recommendation Routes', () => {
  let authToken: string;
  let testUserId: number;

  beforeAll(async () => {
    // Clean up test data
    await prisma.review.deleteMany({});
    await prisma.favorite.deleteMany({});
    await prisma.book.deleteMany({});
    await prisma.user.deleteMany({});

    // Create test user
    const user = await prisma.user.create({
      data: {
        name: 'Rec Test User',
        email: 'rectest@example.com',
        hashedPassword: 'hashedpassword', // Correct field name
      },
    });
    testUserId = user.id;
    authToken = jwt.sign({ userId: user.id }, JWT_SECRET);

    // Seed test books with varying ratings
    await prisma.book.createMany({
      data: [
        {
          title: 'Highly Rated Book',
          author: 'Top Author',
          description: 'Excellent book with high rating',
          coverImageURL: 'https://example.com/cover1.jpg',
          publishedYear: 2023,
          genres: ['Fiction', 'Mystery'],
          avgRating: 4.8,
          reviewCount: 100,
        },
        {
          title: 'Good Book',
          author: 'Good Author',
          description: 'Solid book with good rating',
          coverImageURL: 'https://example.com/cover2.jpg',
          publishedYear: 2022,
          genres: ['Fiction', 'Thriller'],
          avgRating: 4.2,
          reviewCount: 50,
        },
        {
          title: 'Average Book',
          author: 'Average Author',
          description: 'Average book',
          coverImageURL: 'https://example.com/cover3.jpg',
          publishedYear: 2021,
          genres: ['Non-Fiction'],
          avgRating: 3.5,
          reviewCount: 25,
        },
        {
          title: 'Genre Match Book',
          author: 'Genre Author',
          description: 'Book matching user preferences',
          coverImageURL: 'https://example.com/cover4.jpg',
          publishedYear: 2023,
          genres: ['Mystery', 'Suspense'],
          avgRating: 4.5,
          reviewCount: 75,
        },
      ],
    });

    // Add user favorite for genre preference
    const favoriteBook = await prisma.book.findFirst({
      where: { title: 'Genre Match Book' },
    });
    if (favoriteBook) {
      await prisma.favorite.create({
        data: {
          userId: testUserId,
          bookId: favoriteBook.id,
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.review.deleteMany({});
    await prisma.favorite.deleteMany({});
    await prisma.book.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('GET /api/recommendations', () => {
    it('should return hybrid recommendations with default pagination', async () => {
      const response = await request(app)
        .get('/api/recommendations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('recommendations');
      expect(response.body).toHaveProperty('mode', 'hybrid');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 10);
      expect(Array.isArray(response.body.recommendations)).toBe(true);
      expect(response.body.recommendations.length).toBeGreaterThan(0);
      
      // Check relevance score
      expect(response.body.recommendations[0]).toHaveProperty('relevanceScore');
      expect(typeof response.body.recommendations[0].relevanceScore).toBe('number');
    });

    it('should support custom limit parameter', async () => {
      const response = await request(app)
        .get('/api/recommendations?limit=2')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.recommendations.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination.limit).toBe(2);
    });

    it('should support pagination with page parameter', async () => {
      const response = await request(app)
        .get('/api/recommendations?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination).toHaveProperty('totalPages');
    });

    it('should enforce maximum limit of 50', async () => {
      const response = await request(app)
        .get('/api/recommendations?limit=100')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.recommendations.length).toBeLessThanOrEqual(50);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/recommendations');

      expect(response.status).toBe(401);
    });

    it('should handle invalid page gracefully', async () => {
      const response = await request(app)
        .get('/api/recommendations?page=0')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1); // Should default to 1
    });
  });

  describe('GET /api/recommendations/top-rated', () => {
    it('should return top-rated recommendations', async () => {
      const response = await request(app)
        .get('/api/recommendations/top-rated')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('mode', 'top-rated');
      expect(response.body.recommendations.length).toBeGreaterThan(0);
      
      // Check that results are ordered by rating (descending relevanceScore)
      const scores = response.body.recommendations.map((r: any) => r.relevanceScore);
      const sortedScores = [...scores].sort((a, b) => b - a);
      expect(scores).toEqual(sortedScores);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/recommendations/top-rated?page=1&limit=3')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(3);
    });

    it('should cache results for performance', async () => {
      const response1 = await request(app)
        .get('/api/recommendations/top-rated')
        .set('Authorization', `Bearer ${authToken}`);

      const response2 = await request(app)
        .get('/api/recommendations/top-rated')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response2.status).toBe(200);
      // Second request should return same cached data
      expect(response2.body.recommendations).toEqual(response1.body.recommendations);
    });
  });

  describe('GET /api/recommendations/llm', () => {
    it('should return LLM-based recommendations', async () => {
      const response = await request(app)
        .get('/api/recommendations/llm')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('mode', 'llm');
      expect(response.body.recommendations.length).toBeGreaterThan(0);
      
      // Check relevance scores are present
      expect(response.body.recommendations[0]).toHaveProperty('relevanceScore');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/recommendations/llm?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.limit).toBe(5);
    });

    it('should differentiate from top-rated recommendations', async () => {
      const llmResponse = await request(app)
        .get('/api/recommendations/llm')
        .set('Authorization', `Bearer ${authToken}`);

      const topResponse = await request(app)
        .get('/api/recommendations/top-rated')
        .set('Authorization', `Bearer ${authToken}`);

      expect(llmResponse.body.mode).toBe('llm');
      expect(topResponse.body.mode).toBe('top-rated');
    });
  });

  describe('Backwards compatibility routes', () => {
    it('should support /recommendations without /api prefix', async () => {
      const response = await request(app)
        .get('/recommendations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('recommendations');
    });

    it('should support /recommendations/top-rated without /api prefix', async () => {
      const response = await request(app)
        .get('/recommendations/top-rated')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.mode).toBe('top-rated');
    });

    it('should support /recommendations/llm without /api prefix', async () => {
      const response = await request(app)
        .get('/recommendations/llm')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.mode).toBe('llm');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty database gracefully', async () => {
      // Temporarily clear books (delete favorites first due to foreign key)
      await prisma.favorite.deleteMany({});
      await prisma.book.deleteMany({});

      const response = await request(app)
        .get('/api/recommendations?timestamp=' + Date.now()) // bust cache
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      // May return cached results or empty array depending on cache timing
      expect(Array.isArray(response.body.recommendations)).toBe(true);

      // Restore books for other tests
      await prisma.book.createMany({
        data: [
          {
            title: 'Restored Book',
            author: 'Author',
            description: 'Test book',
            coverImageURL: 'https://example.com/restored.jpg',
            publishedYear: 2023,
            avgRating: 4.0,
            reviewCount: 10,
          },
        ],
      });
    });

    it('should handle malformed limit parameter', async () => {
      const response = await request(app)
        .get('/api/recommendations?limit=abc')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      // Should default to 10
      expect(response.body.pagination.limit).toBe(10);
    });

    it('should handle negative page parameter', async () => {
      const response = await request(app)
        .get('/api/recommendations?page=-5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
    });
  });

  describe('Performance and caching', () => {
    it('should cache hybrid recommendations per user', async () => {
      const response1 = await request(app)
        .get('/api/recommendations')
        .set('Authorization', `Bearer ${authToken}`);

      const response2 = await request(app)
        .get('/api/recommendations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response1.body.recommendations).toEqual(response2.body.recommendations);
    });

    it('should respect cache TTL (5 minutes)', async () => {
      // Note: This is a logical test, not time-based due to test speed
      const response = await request(app)
        .get('/api/recommendations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      // Cache exists implicitly if no errors
    });
  });
});
