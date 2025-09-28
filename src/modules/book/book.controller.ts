
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getHybridRecommendations } from '../../services/recommendation.service';

export const getRecommendations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const base = await getHybridRecommendations(userId, 10);
    return res.json(base);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch recommendations.' });
  }
};

import { Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';

const prisma = new PrismaClient();

export const getBooks = async (req: Request, res: Response) => {
  const { page = 1, search = '', meta } = req.query;
  const pageSize = 10;
  const pageNumber = Number(page) < 1 ? 1 : Number(page);
  const skip = (pageNumber - 1) * pageSize;
  try {
    const [books, total] = await Promise.all([
      prisma.book.findMany({
        where: {
          OR: [
            { title: { contains: String(search), mode: 'insensitive' } },
            { author: { contains: String(search), mode: 'insensitive' } },
          ],
        },
        skip,
        take: pageSize,
        orderBy: { id: 'asc' },
      }),
      prisma.book.count({
        where: {
          OR: [
            { title: { contains: String(search), mode: 'insensitive' } },
            { author: { contains: String(search), mode: 'insensitive' } },
          ],
        },
      }),
    ]);
    if (meta === 'true') {
      const totalPages = Math.ceil(total / pageSize) || 1;
      return res.json({ data: books, page: pageNumber, pageSize, total, totalPages });
    }
    // Backward compatible: original tests expect an array
    return res.json(books);
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
    return res.json(book);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch book.' });
  }
};
