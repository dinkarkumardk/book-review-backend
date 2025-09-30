import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

const prisma = new PrismaClient();

async function recalculateBookStats(bookId: number) {
  return await prisma.$transaction(async (tx: any) => {
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

export const getBookReviews = async (req: AuthenticatedRequest, res: Response) => {
  const { bookId } = req.params;
  try {
    const reviews = await prisma.review.findMany({
      where: { bookId: Number(bookId) },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
      },
    });
    return res.json(reviews);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch reviews.' });
  }
};

export const getReview = async (req: AuthenticatedRequest, res: Response) => {
  const { reviewId } = req.params;
  try {
    const review = await prisma.review.findUnique({
      where: { id: Number(reviewId) },
      include: { user: { select: { id: true, name: true } } },
    });
    if (!review) return res.status(404).json({ error: 'Review not found.' });
    return res.json(review);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch review.' });
  }
};

export const getBookReviewSummary = async (req: AuthenticatedRequest, res: Response) => {
  const { bookId } = req.params;
  try {
    const book = await prisma.book.findUnique({ where: { id: Number(bookId) }, select: { id: true, avgRating: true, reviewCount: true } });
    if (!book) return res.status(404).json({ error: 'Book not found.' });
    return res.json({ bookId: book.id, avgRating: book.avgRating, reviewCount: book.reviewCount });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch review summary.' });
  }
};

export const createReview = async (req: AuthenticatedRequest, res: Response) => {
  const { bookId } = req.params;
  const { rating, text } = req.body;
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (rating === undefined || rating === null || !text) return res.status(400).json({ error: 'Rating and text required.' });
  if (typeof rating !== 'number' || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
  try {
    // Prevent duplicate review by same user on same book (enforce single review per user/book)
    const existing = await prisma.review.findFirst({ where: { userId, bookId: Number(bookId) } });
    if (existing) return res.status(409).json({ error: 'User has already reviewed this book.' });
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
    if (rating !== undefined) {
      if (typeof rating !== 'number' || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }
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
