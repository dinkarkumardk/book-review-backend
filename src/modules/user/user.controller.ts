import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export const getUserProfile = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        reviews: {
          include: {
            book: {
              select: { id: true, title: true }
            }
          }
        },
        favorites: {
          include: {
            book: {
              select: { id: true, title: true }
            }
          }
        }
      }
    });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch profile.' });
  }
};

export const toggleFavorite = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId;
  const { bookId } = req.body;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!bookId) return res.status(400).json({ error: 'Book ID required.' });
  try {
    const favorite = await prisma.favorite.findUnique({
      where: { userId_bookId: { userId, bookId } }
    });
    if (favorite) {
      await prisma.favorite.delete({ where: { id: favorite.id } });
      return res.json({ message: 'Book removed from favorites.' });
    } else {
      await prisma.favorite.create({ data: { userId, bookId } });
      return res.json({ message: 'Book added to favorites.' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Failed to toggle favorite.' });
  }
};
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

export const registerUser = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already in use.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, hashedPassword },
    });
    return res.status(201).json({ id: user.id, name: user.name, email: user.email });
  } catch (error) {
    return res.status(500).json({ error: 'Registration failed.' });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    const isMatch = await bcrypt.compare(password, user.hashedPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
    return res.json({ token });
  } catch (error) {
    return res.status(500).json({ error: 'Login failed.' });
  }
};
