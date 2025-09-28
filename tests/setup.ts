import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Mock Prisma
jest.mock('../src/generated/prisma', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrismaClient),
}));

// Mock Prisma Client globally
const mockPrismaClient: any = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  book: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  review: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  favorite: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn((callback: any) => callback(mockPrismaClient)),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

// Helper functions for tests
export const createValidToken = (userId: number = 1): string => {
  return jwt.sign({ userId }, JWT_SECRET);
};

export const createAuthHeader = (userId: number = 1): { Authorization: string } => {
  return { Authorization: `Bearer ${createValidToken(userId)}` };
};

// Mock the PrismaClient constructor
jest.mock('../src/generated/prisma', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

// Export the mock for use in tests
export { mockPrismaClient };

// Global test setup
beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  // Cleanup
});