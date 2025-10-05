import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Prisma, PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getHybridRecommendations, getTopRatedRecommendations as fetchTopRatedRecommendations } from '../../services/recommendation.service';
import { getLLMBookRecommendations } from '../../services/llmRecommender.service';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

type SortKey = 'title' | 'author' | 'rating' | 'reviews' | 'publishedYear';

function resolveSortKey(raw?: string): SortKey {
  const normalized = String(raw || '').toLowerCase();
  switch (normalized) {
    case 'author':
      return 'author';
    case 'rating':
    case 'avg':
    case 'avgRating':
      return 'rating';
    case 'reviews':
    case 'reviewcount':
      return 'reviews';
    case 'published':
    case 'year':
    case 'publishedyear':
      return 'publishedYear';
    case 'title':
    default:
      return 'title';
  }
}

function resolveOrder(direction?: string): Prisma.SortOrder {
  return direction === 'desc' ? 'desc' : 'asc';
}

function buildOrderBy(sortKey: SortKey, direction: Prisma.SortOrder): Prisma.BookOrderByWithRelationInput {
  switch (sortKey) {
    case 'author':
      return { author: direction };
    case 'rating':
      return { avgRating: direction };
    case 'reviews':
      return { reviewCount: direction };
    case 'publishedYear':
      return { publishedYear: direction };
    case 'title':
    default:
      return { title: direction };
  }
}

function buildBookWhere(searchTerm: string, genre?: string): Prisma.BookWhereInput {
  const trimmed = searchTerm.trim();
  const where: Prisma.BookWhereInput = {};
  const includeSearch = trimmed.length > 0;
  where.OR = [
    { title: { contains: trimmed, mode: 'insensitive' } },
    { author: { contains: trimmed, mode: 'insensitive' } },
  ];

  if (!includeSearch) {
    // Preserve backwards compatibility by allowing empty search to return all books
    where.OR = [
      { title: { contains: '', mode: 'insensitive' } },
      { author: { contains: '', mode: 'insensitive' } },
    ];
  }

  if (genre && genre !== 'all') {
    where.genres = { has: genre };
  }

  return where;
}

async function fetchBooksPage(params: {
  page: number;
  pageSize: number;
  where: Prisma.BookWhereInput;
  orderBy: Prisma.BookOrderByWithRelationInput;
}) {
  const { page, pageSize, where, orderBy } = params;
  const skip = (page - 1) * pageSize;
  const [books, total] = await Promise.all([
    prisma.book.findMany({ where, skip, take: pageSize, orderBy }),
    prisma.book.count({ where }),
  ]);
  const totalPages = total === 0 ? 0 : Math.max(1, Math.ceil(total / pageSize));
  return { data: books, page, pageSize, total, totalPages };
}

function resolveOptionalUserId(req: Request): number | undefined {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return undefined;
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: number };
    return decoded?.userId;
  } catch (err) {
    return undefined;
  }
}

async function annotateWithFavorites<T extends { id: number }>(books: T[], userId?: number) {
  if (!books.length) {
    return books.map((book) => ({ ...book, isFavorite: false }));
  }

  if (!userId) {
    return books.map((book) => ({ ...book, isFavorite: false }));
  }

  const favorites = await prisma.favorite.findMany({
    where: { userId, bookId: { in: books.map((book) => book.id) } },
    select: { bookId: true },
  });
  const favoriteIds = new Set(favorites.map((fav) => fav.bookId));
  return books.map((book) => ({ ...book, isFavorite: favoriteIds.has(book.id) }));
}

// Simple in-memory cache with TTL
const recommendationCache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key: string): any[] | null {
  const entry = recommendationCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    recommendationCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: any[]) {
  recommendationCache.set(key, { data, timestamp: Date.now() });
}

function setAuthAwareCacheHeaders(res: Response) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.append('Vary', 'Authorization');
}

export const getRecommendations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const page = Math.max(Number(req.query.page) || 1, 1);
    
    const cacheKey = `hybrid:${userId}:${limit}`;
    let allRecs = getCached(cacheKey);
    
    if (!allRecs) {
      allRecs = await getHybridRecommendations(userId, limit * 3); // fetch more for pagination
      setCache(cacheKey, allRecs);
    }
    
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedRecs = allRecs.slice(start, end);
    const total = allRecs.length;
    const totalPages = Math.ceil(total / limit);
    
    return res.json({ 
      recommendations: paginatedRecs.map((r: any) => ({ ...r, relevanceScore: 0.85 })),
      mode: 'hybrid',
      pagination: { page, limit, total, totalPages }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch recommendations.' });
  }
};

export const getTopRatedRecommendations = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(Number(_req.query.limit) || 10, 50);
    const page = Math.max(Number(_req.query.page) || 1, 1);
    
    const cacheKey = `toprated:${limit}`;
    let allRecs = getCached(cacheKey);
    
    if (!allRecs) {
      allRecs = await fetchTopRatedRecommendations(limit * 3);
      setCache(cacheKey, allRecs);
    }
    
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedRecs = allRecs.slice(start, end);
    const total = allRecs.length;
    const totalPages = Math.ceil(total / limit);
    
    return res.json({ 
      recommendations: paginatedRecs.map((r: any, idx: number) => ({ 
        ...r, 
        relevanceScore: Math.max(0.95 - (idx * 0.02), 0.5) 
      })),
      mode: 'top-rated',
      pagination: { page, limit, total, totalPages }
    });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to fetch top-rated recommendations.' });
  }
};

export const getLLMRecommendations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const page = Math.max(Number(req.query.page) || 1, 1);
    
    const cacheKey = `llm:${userId}:${limit}`;
    let allRecs = getCached(cacheKey);
    
    if (!allRecs) {
      allRecs = await getLLMBookRecommendations(userId, limit * 3);
      setCache(cacheKey, allRecs);
    }
    
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedRecs = allRecs.slice(start, end);
    const total = allRecs.length;
    const totalPages = Math.ceil(total / limit);
    
    return res.json({ 
      recommendations: paginatedRecs.map((r: any, idx: number) => ({ 
        ...r, 
        relevanceScore: Math.max(0.92 - (idx * 0.03), 0.6) 
      })),
      mode: 'llm',
      pagination: { page, limit, total, totalPages }
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to fetch LLM recommendations.' });
  }
};

export const getBooks = async (req: Request, res: Response) => {
  const { page = 1, search = '', meta, limit, genre, sort, order, facets } = req.query;
  const pageSize = limit ? Math.min(Math.max(Number(limit) || 10, 1), 100) : 10;
  const pageNumber = Number(page) < 1 ? 1 : Number(page);
  const sortKey = resolveSortKey(typeof sort === 'string' ? sort : undefined);
  const sortOrder = resolveOrder(typeof order === 'string' ? order : undefined);
  const where = buildBookWhere(String(search || ''), typeof genre === 'string' ? genre : undefined);
  const orderBy = buildOrderBy(sortKey, sortOrder);
  const includeFacets = facets === 'true';

  try {
    const result = await fetchBooksPage({
      page: pageNumber,
      pageSize,
      where,
      orderBy,
    });

    let availableGenres: string[] | undefined;
    if (includeFacets) {
      const genreRows = await prisma.book.findMany({ select: { genres: true } });
      const genreSet = new Set<string>();
      genreRows.forEach((row) => {
        (row.genres || []).forEach((g) => genreSet.add(g));
      });
      availableGenres = Array.from(genreSet).sort((a, b) => a.localeCompare(b));
    }

    const userId = resolveOptionalUserId(req);
    const booksWithFavorite = await annotateWithFavorites(result.data, userId);

    setAuthAwareCacheHeaders(res);

    if (meta === 'true') {
      return res.json({
        data: booksWithFavorite,
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
        availableGenres,
      });
    }

    return res.json(booksWithFavorite);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch books.' });
  }
};

export const getBookById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const book = await prisma.book.findUnique({
      where: { id: Number(id) },
      include: { reviews: true },
    });
    if (!book) {
      return res.status(404).json({ error: 'Book not found.' });
    }

    const userId = resolveOptionalUserId(req);
    let isFavorite = false;

    if (userId) {
      const favorite = await prisma.favorite.findUnique({
        where: {
          userId_bookId: {
            userId,
            bookId: book.id,
          },
        },
        select: { bookId: true },
      });
      isFavorite = Boolean(favorite);
    }

    setAuthAwareCacheHeaders(res);

    return res.json({ ...book, isFavorite });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch book.' });
  }
};

export const searchBooks = async (req: Request, res: Response) => {
  const { q = '', page = 1, limit, genre, sort, order } = req.query;
  const searchTerm = String(q || '').trim();
  const pageSize = limit ? Math.min(Math.max(Number(limit) || 10, 1), 100) : 10;
  const pageNumber = Number(page) < 1 ? 1 : Number(page);
  if (!searchTerm) {
    return res.json({ data: [], page: 1, pageSize, total: 0, totalPages: 0 });
  }

  const sortKey = resolveSortKey(typeof sort === 'string' ? sort : undefined);
  const sortOrder = resolveOrder(typeof order === 'string' ? order : undefined);
  const where = buildBookWhere(searchTerm, typeof genre === 'string' ? genre : undefined);
  const orderBy = buildOrderBy(sortKey, sortOrder);

  try {
    const result = await fetchBooksPage({ page: pageNumber, pageSize, where, orderBy });
    const userId = resolveOptionalUserId(req);
    const booksWithFavorite = await annotateWithFavorites(result.data, userId);

    setAuthAwareCacheHeaders(res);

    return res.json({
      data: booksWithFavorite,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to search books.' });
  }
};
