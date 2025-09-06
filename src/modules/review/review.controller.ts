import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

const prisma = new PrismaClient();

async function recalculateBookStats(bookId: number) {
  return await prisma.$transaction(async (tx: PrismaClient) => {
    const reviews = await tx.review.findMany({
      where: { bookId },
      select: { rating: true },
    });
    const reviewCount = reviews.length;
    const avgRating = reviewCount > 0
      ? reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviewCount
      : 0;
    await tx.book.update({
      where: { id: bookId },
      data: {
        avgRating: Math.round(avgRating * 10) / 10,
        reviewCount,
      },
    });
  });
}

export const createReview = async (req: AuthenticatedRequest, res: Response) => {
  const { bookId } = req.params;
  const { rating, text } = req.body;
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!rating || !text) return res.status(400).json({ error: 'Rating and text required.' });
  try {
    const review = await prisma.review.create({
      data: {
        rating,
        text,
        userId,
        bookId: Number(bookId),
      },
    });
    await recalculateBookStats(Number(bookId));
    return res.status(201).json(review);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create review.' });
  }
};

export const updateReview = async (req: AuthenticatedRequest, res: Response) => {
  const { reviewId } = req.params;
  const { rating, text } = req.body;
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const review = await prisma.review.findUnique({ where: { id: Number(reviewId) } });
    if (!review) return res.status(404).json({ error: 'Review not found.' });
    if (review.userId !== userId) return res.status(403).json({ error: 'Forbidden: Not review author.' });
    const updated = await prisma.review.update({
      where: { id: Number(reviewId) },
      data: { rating, text },
    });
    await recalculateBookStats(review.bookId);
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update review.' });
  }
};

export const deleteReview = async (req: AuthenticatedRequest, res: Response) => {
  const { reviewId } = req.params;
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const review = await prisma.review.findUnique({ where: { id: Number(reviewId) } });
    if (!review) return res.status(404).json({ error: 'Review not found.' });
    if (review.userId !== userId) return res.status(403).json({ error: 'Forbidden: Not review author.' });
    await prisma.review.delete({ where: { id: Number(reviewId) } });
    await recalculateBookStats(review.bookId);
    return res.json({ message: 'Review deleted.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete review.' });
  }
};
