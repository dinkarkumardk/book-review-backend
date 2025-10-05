import { getHybridRecommendations } from '../src/services/recommendation.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Recommendation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getHybridRecommendations', () => {
    it('should return top-rated books for undefined user', async () => {
      const mockBooks = [
        {
          id: 1,
          title: 'Top Book',
          author: 'Author',
          description: 'Description',
          coverImageURL: 'cover.jpg',
          genres: ['Fiction'],
          publishedYear: 2023,
          avgRating: 4.5,
          reviewCount: 100,
          favoritedBy: [],
          reviews: [],
        },
      ];

      (prisma.book.findMany as jest.Mock).mockResolvedValue(mockBooks);

      const result = await getHybridRecommendations(undefined, 5);

      expect(result).toEqual(mockBooks);
      expect(prisma.book.findMany).toHaveBeenCalledWith({
        orderBy: [{ avgRating: 'desc' }, { reviewCount: 'desc' }],
        take: 5,
      });
    });

    it('should return top-rated books for user with no favorites', async () => {
      const mockBooks = [
        {
          id: 1,
          title: 'Top Book',
          author: 'Author',
          description: 'Description',
          coverImageURL: 'cover.jpg',
          genres: ['Fiction'],
          publishedYear: 2023,
          avgRating: 4.5,
          reviewCount: 100,
          favoritedBy: [],
          reviews: [],
        },
      ];

      (prisma.favorite.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.book.findMany as jest.Mock).mockResolvedValue(mockBooks);

      const result = await getHybridRecommendations(1, 5);

      expect(result).toEqual(mockBooks);
      expect(prisma.favorite.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        include: { book: true },
      });
    });

    it('should return genre-based recommendations for user with favorites', async () => {
      const mockFavorites = [
        {
          id: 1,
          userId: 1,
          bookId: 1,
          book: {
            id: 1,
            title: 'Favorite Book',
            author: 'Author',
            description: 'Description',
            coverImageURL: 'cover.jpg',
            genres: ['Fiction', 'Romance'],
            publishedYear: 2023,
            avgRating: 4.5,
            reviewCount: 50,
            favoritedBy: [],
            reviews: [],
          },
        },
      ];

      const mockRecommendations = [
        {
          id: 2,
          title: 'Similar Book',
          author: 'Another Author',
          description: 'Similar Description',
          coverImageURL: 'cover2.jpg',
          genres: ['Fiction'],
          publishedYear: 2023,
          avgRating: 4.3,
          reviewCount: 30,
          favoritedBy: [],
          reviews: [],
        },
      ];

      (prisma.favorite.findMany as jest.Mock).mockResolvedValue(mockFavorites);
      (prisma.book.findMany as jest.Mock).mockResolvedValue(mockRecommendations);

      const result = await getHybridRecommendations(1, 5);

      expect(result).toEqual(mockRecommendations);
      expect(prisma.book.findMany).toHaveBeenCalledWith({
        where: { genres: { hasSome: ['Fiction', 'Romance'] } },
        orderBy: [{ avgRating: 'desc' }, { reviewCount: 'desc' }],
        take: 10, // limit * 2
      });
    });

    it('should fallback to top-rated if genre-based recommendations are insufficient', async () => {
      const mockFavorites = [
        {
          id: 1,
          userId: 1,
          bookId: 1,
          book: {
            id: 1,
            title: 'Favorite Book',
            author: 'Author',
            description: 'Description',
            coverImageURL: 'cover.jpg',
            genres: ['Fiction'],
            publishedYear: 2023,
            avgRating: 4.5,
            reviewCount: 50,
            favoritedBy: [],
            reviews: [],
          },
        },
      ];

      const mockGenreBooks = [
        {
          id: 2,
          title: 'Genre Book',
          author: 'Author',
          description: 'Description',
          coverImageURL: 'cover.jpg',
          genres: ['Fiction'],
          publishedYear: 2023,
          avgRating: 4.0,
          reviewCount: 20,
          favoritedBy: [],
          reviews: [],
        },
      ];

      const mockTopRated = [
        {
          id: 3,
          title: 'Top Book',
          author: 'Author',
          description: 'Description',
          coverImageURL: 'cover.jpg',
          genres: ['Non-Fiction'],
          publishedYear: 2023,
          avgRating: 4.8,
          reviewCount: 100,
          favoritedBy: [],
          reviews: [],
        },
      ];

      (prisma.favorite.findMany as jest.Mock).mockResolvedValue(mockFavorites);
      (prisma.book.findMany as jest.Mock)
        .mockResolvedValueOnce(mockGenreBooks) // First call for genre-based
        .mockResolvedValueOnce(mockTopRated); // Second call for top-rated fallback

      const result = await getHybridRecommendations(1, 3);

      expect(result).toHaveLength(2);
      expect(result).toEqual([...mockGenreBooks, ...mockTopRated.slice(0, 2)]);
    });
  });
});