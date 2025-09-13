
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export const getRecommendations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const books = await prisma.book.findMany({
      orderBy: [
        { avgRating: 'desc' },
        { reviewCount: 'desc' }
      ],
      take: 10,
    });
    return res.json(books);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch recommendations.' });
  }
};
import { Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';

const prisma = new PrismaClient();

export const getBooks = async (req: Request, res: Response) => {
  const { page = 1, search = '' } = req.query;
  const pageSize = 10;
  const skip = (Number(page) - 1) * pageSize;
  try {
    const books = await prisma.book.findMany({
      where: {
        OR: [
          { title: { contains: String(search), mode: 'insensitive' } },
          { author: { contains: String(search), mode: 'insensitive' } },
        ],
      },
      skip,
      take: pageSize,
      orderBy: { id: 'asc' },
    });
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
