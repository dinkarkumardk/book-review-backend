import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

type PrimitiveRecord = Record<string, any>;

type OrderByClause =
  | Record<string, 'asc' | 'desc'>
  | Array<Record<string, 'asc' | 'desc'>>;

type FindManyArgs = {
  where?: PrimitiveRecord;
  include?: PrimitiveRecord;
  orderBy?: OrderByClause;
  take?: number;
  skip?: number;
};

type UpdateArgs = {
  where: PrimitiveRecord;
  data: PrimitiveRecord;
};

type DeleteManyArgs = {
  where?: PrimitiveRecord;
};

type CreateArgs = {
  data: PrimitiveRecord;
};

type CreateManyArgs = {
  data: PrimitiveRecord[];
};

type FindUniqueArgs = {
  where: PrimitiveRecord;
  include?: PrimitiveRecord;
};

type FindFirstArgs = FindManyArgs;

type CountArgs = {
  where?: PrimitiveRecord;
};

interface InMemoryStore {
  users: PrimitiveRecord[];
  books: PrimitiveRecord[];
  favorites: PrimitiveRecord[];
  reviews: PrimitiveRecord[];
}

const store: InMemoryStore = {
  users: [],
  books: [],
  favorites: [],
  reviews: [],
};

const sequence = {
  user: 1,
  book: 1,
  favorite: 1,
  review: 1,
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const applyOrder = (items: PrimitiveRecord[], orderBy?: OrderByClause): PrimitiveRecord[] => {
  if (!orderBy) return items;
  const clauses = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...items].sort((a, b) => {
    for (const clause of clauses) {
      const [key, direction] = Object.entries(clause)[0];
      if (a[key] === b[key]) continue;
      const multiplier = direction === 'desc' ? -1 : 1;
      return a[key] > b[key] ? multiplier : -multiplier;
    }
    return 0;
  });
};

const applyPagination = (items: PrimitiveRecord[], args?: FindManyArgs): PrimitiveRecord[] => {
  const skip = args?.skip ?? 0;
  const take = args?.take ?? items.length;
  return items.slice(skip, skip + take);
};

const matchesStringContains = (value: string, search?: PrimitiveRecord) => {
  if (!search) return true;
  const { contains, mode } = search;
  if (contains === undefined || contains === null) return true;
  const haystack = mode === 'insensitive' ? value.toLowerCase() : value;
  const needle = mode === 'insensitive' ? String(contains).toLowerCase() : String(contains);
  return haystack.includes(needle);
};

const filterBooks = (books: PrimitiveRecord[], where?: PrimitiveRecord): PrimitiveRecord[] => {
  if (!where) return books;
  let result = [...books];

  if (where.OR && Array.isArray(where.OR)) {
    result = result.filter((book) =>
      where.OR.some((clause: PrimitiveRecord) => {
        if (clause.title) {
          if (!matchesStringContains(book.title, clause.title)) return false;
        }
        if (clause.author) {
          if (!matchesStringContains(book.author, clause.author)) return false;
        }
        return true;
      }),
    );
  }

  if (where.genres?.hasSome) {
    const targetGenres: string[] = where.genres.hasSome;
    result = result.filter((book) =>
      Array.isArray(book.genres) && book.genres.some((genre: string) => targetGenres.includes(genre)),
    );
  }

  if (where.id !== undefined) {
    const id = typeof where.id === 'object' ? where.id.equals ?? where.id : where.id;
    result = result.filter((book) => book.id === id);
  }

  return result;
};

const filterFavorites = (favorites: PrimitiveRecord[], where?: PrimitiveRecord): PrimitiveRecord[] => {
  if (!where) return favorites;
  let result = [...favorites];
  if (where.userId !== undefined) {
    result = result.filter((fav) => fav.userId === where.userId);
  }
  if (where.bookId !== undefined) {
    result = result.filter((fav) => fav.bookId === where.bookId);
  }
  if (where.userId_bookId) {
    result = result.filter(
      (fav) => fav.userId === where.userId_bookId.userId && fav.bookId === where.userId_bookId.bookId,
    );
  }
  return result;
};

const filterReviews = (reviews: PrimitiveRecord[], where?: PrimitiveRecord): PrimitiveRecord[] => {
  if (!where) return reviews;
  let result = [...reviews];
  if (where.userId !== undefined) {
    result = result.filter((rev) => rev.userId === where.userId);
  }
  if (where.bookId !== undefined) {
    const target = typeof where.bookId === 'object' ? where.bookId.equals ?? where.bookId : where.bookId;
    result = result.filter((rev) => rev.bookId === target);
  }
  if (where.id !== undefined) {
    const id = typeof where.id === 'object' ? where.id.equals ?? where.id : where.id;
    result = result.filter((rev) => rev.id === id);
  }
  return result;
};

const decorateFavorites = (favorites: PrimitiveRecord[], include?: PrimitiveRecord) => {
  if (!include?.book) return favorites.map(clone);
  return favorites.map((fav) => ({
    ...clone(fav),
    book: clone(store.books.find((book) => book.id === fav.bookId) ?? null),
  }));
};

const decorateReviews = (reviews: PrimitiveRecord[], include?: PrimitiveRecord) => {
  return reviews.map((review) => ({
    ...clone(review),
    ...(include?.book
      ? {
          book: clone(
            store.books
              .filter((book) => book.id === review.bookId)
              .map((book) => {
                if (!include.book?.select) return book;
                const selected: PrimitiveRecord = {};
                Object.keys(include.book.select).forEach((key) => {
                  if (include.book.select[key]) selected[key] = book[key];
                });
                return selected;
              })[0] ?? null,
          ),
        }
      : {}),
    ...(include?.user
      ? {
          user: clone(
            store.users
              .filter((user) => user.id === review.userId)
              .map((user) => {
                if (!include.user?.select) return user;
                const selected: PrimitiveRecord = {};
                Object.keys(include.user.select).forEach((key) => {
                  if (include.user.select[key]) selected[key] = user[key];
                });
                return selected;
              })[0] ?? null,
          ),
        }
      : {}),
  }));
};

const mockPrismaClient: any = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  book: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  review: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  favorite: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(async (callback: any) => callback(mockPrismaClient)),
  $connect: jest.fn(async () => undefined),
  $disconnect: jest.fn(async () => undefined),
};

const applyDefaultMockImplementations = () => {
  mockPrismaClient.user.create.mockImplementation(async ({ data }: CreateArgs) => {
    const newUser = { ...clone(data), id: sequence.user++ };
    store.users.push(newUser);
    return clone(newUser);
  });

  mockPrismaClient.user.findUnique.mockImplementation(async ({ where, include }: FindUniqueArgs) => {
    const candidate = store.users.find((user) => {
      if (where.id !== undefined) return user.id === where.id;
      if (where.email !== undefined) return user.email === where.email;
      return false;
    });
    if (!candidate) return null;
    if (!include) return clone(candidate);
    const response: PrimitiveRecord = {};
    Object.keys(include).forEach((key) => {
      if (!include[key]) return;
      if (key === 'reviews') {
        response.reviews = decorateReviews(
          store.reviews.filter((review) => review.userId === candidate.id),
          include[key],
        );
      } else if (key === 'favorites') {
        response.favorites = decorateFavorites(
          store.favorites.filter((fav) => fav.userId === candidate.id),
          include[key],
        );
      } else {
        response[key] = candidate[key];
      }
    });
    if (include.id) response.id = candidate.id;
    if (include.name) response.name = candidate.name;
    if (include.email) response.email = candidate.email;
    return clone(response);
  });

  mockPrismaClient.user.findMany.mockImplementation(async () => clone(store.users));

  mockPrismaClient.user.update.mockImplementation(async ({ where, data }: UpdateArgs) => {
    const user = store.users.find((u) => u.id === where.id);
    if (!user) throw new Error('User not found');
    Object.assign(user, clone(data));
    return clone(user);
  });

  mockPrismaClient.user.delete.mockImplementation(async ({ where }: { where: PrimitiveRecord }) => {
    const idx = store.users.findIndex((u) => u.id === where.id);
    if (idx === -1) throw new Error('User not found');
    const [removed] = store.users.splice(idx, 1);
    return clone(removed);
  });

  mockPrismaClient.user.deleteMany.mockImplementation(async ({ where }: DeleteManyArgs = {}) => {
    const before = store.users.length;
    if (!where || Object.keys(where).length === 0) {
      store.users.splice(0, store.users.length);
    } else if (where.id !== undefined) {
      store.users.splice(
        0,
        store.users.length,
        ...store.users.filter((user) => user.id !== where.id),
      );
    }
    return { count: before - store.users.length };
  });

  mockPrismaClient.book.create.mockImplementation(async ({ data }: CreateArgs) => {
    const newBook = { ...clone(data), id: sequence.book++ };
    store.books.push(newBook);
    return clone(newBook);
  });

  mockPrismaClient.book.createMany.mockImplementation(async ({ data }: CreateManyArgs) => {
    const entries = data.map((item) => ({
      ...clone(item),
      id: sequence.book++,
    }));
    store.books.push(...entries);
    return { count: entries.length };
  });

  mockPrismaClient.book.findMany.mockImplementation(async (args: FindManyArgs = {}) => {
    const filtered = filterBooks(store.books, args.where);
    const ordered = applyOrder(filtered, args.orderBy);
    const paginated = applyPagination(ordered, args);
    return clone(paginated);
  });

  mockPrismaClient.book.count.mockImplementation(async (args: CountArgs = {}) => {
    const filtered = filterBooks(store.books, args.where);
    return filtered.length;
  });

  mockPrismaClient.book.findUnique.mockImplementation(async ({ where }: FindUniqueArgs) => {
    const id = typeof where.id === 'object' ? where.id.equals ?? where.id : where.id;
    const book = store.books.find((entry) => entry.id === id);
    return book ? clone(book) : null;
  });

  mockPrismaClient.book.findFirst.mockImplementation(async ({ where }: FindFirstArgs = {}) => {
    const filtered = filterBooks(store.books, where);
    return filtered.length ? clone(filtered[0]) : null;
  });

  mockPrismaClient.book.update.mockImplementation(async ({ where, data }: UpdateArgs) => {
    const book = store.books.find((entry) => entry.id === where.id);
    if (!book) throw new Error('Book not found');
    Object.assign(book, clone(data));
    return clone(book);
  });

  mockPrismaClient.book.delete.mockImplementation(async ({ where }: { where: PrimitiveRecord }) => {
    const idx = store.books.findIndex((entry) => entry.id === where.id);
    if (idx === -1) throw new Error('Book not found');
    const [removed] = store.books.splice(idx, 1);
    return clone(removed);
  });

  mockPrismaClient.book.deleteMany.mockImplementation(async ({ where }: DeleteManyArgs = {}) => {
    const before = store.books.length;
    if (!where || Object.keys(where).length === 0) {
      store.books.splice(0, store.books.length);
    } else if (where.id?.in) {
      const ids: number[] = where.id.in;
      store.books.splice(
        0,
        store.books.length,
        ...store.books.filter((entry) => !ids.includes(entry.id)),
      );
    }
    return { count: before - store.books.length };
  });

  mockPrismaClient.review.create.mockImplementation(async ({ data }: CreateArgs) => {
    const timestamp = new Date().toISOString();
    const review = {
      ...clone(data),
      id: sequence.review++,
      createdAt: data.createdAt ?? timestamp,
      updatedAt: data.updatedAt ?? timestamp,
    };
    store.reviews.push(review);
    return clone(review);
  });

  mockPrismaClient.review.findMany.mockImplementation(async (args: FindManyArgs = {}) => {
    let filtered = filterReviews(store.reviews, args.where);
    const ordered = applyOrder(filtered, args.orderBy);
    const paginated = applyPagination(ordered, args);
    return decorateReviews(paginated, args.include);
  });

  mockPrismaClient.review.findUnique.mockImplementation(async ({ where, include }: FindUniqueArgs) => {
    const filtered = filterReviews(store.reviews, where);
    if (filtered.length === 0) return null;
    return decorateReviews([filtered[0]], include)[0];
  });

  mockPrismaClient.review.findFirst.mockImplementation(async ({ where, include }: FindFirstArgs = {}) => {
    const filtered = filterReviews(store.reviews, where);
    if (!filtered.length) return null;
    return decorateReviews([filtered[0]], include)[0];
  });

  mockPrismaClient.review.update.mockImplementation(async ({ where, data }: UpdateArgs) => {
    const review = store.reviews.find((entry) => entry.id === where.id);
    if (!review) throw new Error('Review not found');
    Object.assign(review, clone(data), { updatedAt: new Date().toISOString() });
    return clone(review);
  });

  mockPrismaClient.review.delete.mockImplementation(async ({ where }: { where: PrimitiveRecord }) => {
    const idx = store.reviews.findIndex((entry) => entry.id === where.id);
    if (idx === -1) throw new Error('Review not found');
    const [removed] = store.reviews.splice(idx, 1);
    return clone(removed);
  });

  mockPrismaClient.review.deleteMany.mockImplementation(async ({ where }: DeleteManyArgs = {}) => {
    const before = store.reviews.length;
    if (!where || Object.keys(where).length === 0) {
      store.reviews.splice(0, store.reviews.length);
    } else if (where.bookId !== undefined) {
      store.reviews.splice(
        0,
        store.reviews.length,
        ...store.reviews.filter((entry) => entry.bookId !== where.bookId),
      );
    } else if (where.userId !== undefined) {
      store.reviews.splice(
        0,
        store.reviews.length,
        ...store.reviews.filter((entry) => entry.userId !== where.userId),
      );
    }
    return { count: before - store.reviews.length };
  });

  mockPrismaClient.favorite.create.mockImplementation(async ({ data }: CreateArgs) => {
    const favorite = { ...clone(data), id: sequence.favorite++ };
    store.favorites.push(favorite);
    return clone(favorite);
  });

  mockPrismaClient.favorite.findUnique.mockImplementation(async ({ where }: FindUniqueArgs) => {
    if (where.id !== undefined) {
      const fav = store.favorites.find((entry) => entry.id === where.id);
      return fav ? clone(fav) : null;
    }
    if (where.userId_bookId) {
      const fav = store.favorites.find(
        (entry) => entry.userId === where.userId_bookId.userId && entry.bookId === where.userId_bookId.bookId,
      );
      return fav ? clone(fav) : null;
    }
    return null;
  });

  mockPrismaClient.favorite.findMany.mockImplementation(async (args: FindManyArgs = {}) => {
    const filtered = filterFavorites(store.favorites, args.where);
    const ordered = applyOrder(filtered, args.orderBy);
    const paginated = applyPagination(ordered, args);
    return decorateFavorites(paginated, args.include);
  });

  mockPrismaClient.favorite.delete.mockImplementation(async ({ where }: { where: PrimitiveRecord }) => {
    const idx = store.favorites.findIndex((entry) => entry.id === where.id);
    if (idx === -1) throw new Error('Favorite not found');
    const [removed] = store.favorites.splice(idx, 1);
    return clone(removed);
  });

  mockPrismaClient.favorite.deleteMany.mockImplementation(async ({ where }: DeleteManyArgs = {}) => {
    const before = store.favorites.length;
    if (!where || Object.keys(where).length === 0) {
      store.favorites.splice(0, store.favorites.length);
    } else if (where.userId !== undefined) {
      store.favorites.splice(
        0,
        store.favorites.length,
        ...store.favorites.filter((entry) => entry.userId !== where.userId),
      );
    }
    return { count: before - store.favorites.length };
  });
};

applyDefaultMockImplementations();

export const createValidToken = (userId: number = 1): string => {
  return jwt.sign({ userId }, JWT_SECRET);
};

export const createAuthHeader = (userId: number = 1): { Authorization: string } => {
  return { Authorization: `Bearer ${createValidToken(userId)}` };
};

export { mockPrismaClient };

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

beforeEach(() => {
  jest.clearAllMocks();
  applyDefaultMockImplementations();
});