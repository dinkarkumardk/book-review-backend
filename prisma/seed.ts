// prisma/seed.ts

import { Book, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { BOOK_CATALOG } from './data/bookCatalog';

const prisma = new PrismaClient();

type SeedUserProfile = {
  name: string;
  email: string;
  favoriteGenres: string[];
  secondaryGenres?: string[];
};

const DEFAULT_PASSWORD = 'Password@123';
const GENRES = Array.from(new Set(BOOK_CATALOG.flatMap((book) => [...book.genres]))).sort();

const AUTHOR_FIRST = [
  'Amelia',
  'Dominic',
  'Harper',
  'Lilia',
  'Mateo',
  'Sabrina',
  'Theo',
  'Valerie',
  'Ezra',
  'Jun',
  'Priya',
  'Noah',
  'Isla',
  'Cormac',
  'Aiden',
  'Sloane',
  'Mira',
  'Orion',
  'Keira',
  'Devin',
];

const REVIEW_TEMPLATES: Record<number, string[]> = {
  5: [
    'Instant favorite. The pacing and emotional payoff were flawless.',
    'Could not stop reading—rich worldbuilding and characters I adore.',
    'A masterclass in genre storytelling; already recommending to friends.',
    'Electric from start to finish. This is why I love reading.',
  ],
  4: [
    'Beautifully written with just a few slow moments.',
    'Inventive ideas and memorable characters—nearly perfect.',
    'Smart, heartfelt, and exciting. I will revisit this world.',
    'A strong entry with clever twists and vivid scenes.',
  ],
  3: [
    'Enjoyable overall, though the middle act dragged a little.',
    'Solid concept with room to tighten the execution.',
    'Some truly great chapters mixed with a few uneven beats.',
    'Entertaining comfort read with familiar tropes.',
  ],
  2: [
    'Interesting premise, but it lost me toward the end.',
    'Could use stronger character arcs to match the worldbuilding.',
    'A handful of standout moments, yet the plot felt rushed.',
  ],
  1: [
    'Not for me—struggled to connect with the characters.',
    'The pacing never clicked; finishing it was a chore.',
  ],
};

let randomSeed = 1337;

function seededRandom() {
  randomSeed = (randomSeed * 1664525 + 1013904223) % 4294967296;
  return randomSeed / 4294967296;
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(seededRandom() * items.length) % items.length];
}

function pickUnique<T>(source: T[], count: number): T[] {
  const pool = [...source];
  const selection: T[] = [];
  while (selection.length < count && pool.length > 0) {
    const index = Math.floor(seededRandom() * pool.length);
    selection.push(pool.splice(index, 1)[0]);
  }
  return selection;
}

function uniqueBooks(books: Book[]): Book[] {
  const seen = new Set<number>();
  const result: Book[] = [];
  for (const book of books) {
    if (seen.has(book.id)) continue;
    seen.add(book.id);
    result.push(book);
  }
  return result;
}

function buildReviewText(rating: number, bookTitle: string, userName: string) {
  const snippets = REVIEW_TEMPLATES[rating] ?? REVIEW_TEMPLATES[3];
  const fragment = pickRandom(snippets);
  return `${fragment} — ${userName.split(' ')[0]} on "${bookTitle}"`;
}

function ratingFor(focusGenres: string[], book: Book) {
  const strongMatch = book.genres.some((genre) => focusGenres.includes(genre));
  if (strongMatch) {
    return 4 + Math.round(seededRandom());
  }
  return Math.max(2, Math.min(5, 2 + Math.round(seededRandom() * 3)));
}

function gatherBooksByGenres(genres: string[], genreMap: Map<string, Book[]>): Book[] {
  const aggregated = genres.flatMap((genre) => genreMap.get(genre) ?? []);
  return uniqueBooks(aggregated);
}

function takeFromPool(pool: Book[], count: number, seen: Set<number>): Book[] {
  const chosen: Book[] = [];
  const candidates = [...pool];
  while (chosen.length < count && candidates.length > 0) {
    const idx = Math.floor(seededRandom() * candidates.length);
    const candidate = candidates.splice(idx, 1)[0];
    if (!candidate) break;
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    chosen.push(candidate);
  }
  return chosen;
}

async function main() {
  console.log('🌱 Resetting catalog, reviews, and favorites...');
  await prisma.review.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.book.deleteMany();

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const userProfiles: SeedUserProfile[] = [
    { name: 'Alice Carter', email: 'alice@example.com', favoriteGenres: ['Science Fiction', 'Adventure'], secondaryGenres: ['Mystery', 'Thriller'] },
    { name: 'Bob Nguyen', email: 'bob@example.com', favoriteGenres: ['Fantasy', 'Young Adult'], secondaryGenres: ['Romance', 'Adventure'] },
    { name: 'Charlie Rivers', email: 'charlie@example.com', favoriteGenres: ['Mystery', 'Thriller'] },
    { name: 'Dana Morales', email: 'dana@example.com', favoriteGenres: ['Historical Fiction', 'Romance'], secondaryGenres: ['Poetry'] },
    { name: 'Elliot Zhang', email: 'elliot@example.com', favoriteGenres: ['Science Fiction', 'Dystopian'] },
    { name: 'Farah Idris', email: 'farah@example.com', favoriteGenres: ['Non-Fiction', 'Biography'], secondaryGenres: ['Business'] },
    { name: 'Gina Torres', email: 'gina@example.com', favoriteGenres: ['Fantasy', 'Adventure'], secondaryGenres: ['Horror'] },
    { name: 'Hector Silva', email: 'hector@example.com', favoriteGenres: ['Thriller', 'Mystery'], secondaryGenres: ['Science Fiction'] },
    { name: 'Isabella Rossi', email: 'isabella@example.com', favoriteGenres: ['Romance', 'Young Adult'], secondaryGenres: ['Fantasy'] },
    { name: 'Joon Park', email: 'joon@example.com', favoriteGenres: ['Science Fiction', 'Non-Fiction'], secondaryGenres: ['Business'] },
    { name: 'Kavya Shah', email: 'kavya@example.com', favoriteGenres: ['Poetry', 'Historical Fiction'], secondaryGenres: ['Romance'] },
    { name: 'Logan Brooks', email: 'logan@example.com', favoriteGenres: ['Horror', 'Thriller'], secondaryGenres: ['Mystery'] },
    { name: 'Maya Hernandez', email: 'maya@example.com', favoriteGenres: ['Self-Help', 'Non-Fiction'], secondaryGenres: ['Biography'] },
    { name: 'Noel Gallagher', email: 'noel@example.com', favoriteGenres: ['Business', 'Science Fiction'], secondaryGenres: ['Adventure'] },
    { name: 'Olivia Bennett', email: 'olivia@example.com', favoriteGenres: ['Fantasy', 'Romance'], secondaryGenres: ['Young Adult'] },
  ];

  const seededUsers = [] as Array<SeedUserProfile & { id: number }>;

  for (const profile of userProfiles) {
    const user = await prisma.user.upsert({
      where: { email: profile.email },
      update: { name: profile.name, hashedPassword: passwordHash },
      create: { name: profile.name, email: profile.email, hashedPassword: passwordHash },
    });
    seededUsers.push({ ...profile, id: user.id });
  }

  console.log(`👥 Prepared ${seededUsers.length} demo users (password: ${DEFAULT_PASSWORD}).`);

  const curatedBooks = BOOK_CATALOG.map((book) => ({
    title: book.title,
    author: book.author,
    description: book.description,
    genres: Array.from(book.genres),
    publishedYear: book.publishedYear,
    coverImageURL: book.coverImageURL,
  }));

  await prisma.book.createMany({
    data: curatedBooks,
    skipDuplicates: true,
  });

  const books = await prisma.book.findMany({ orderBy: { id: 'asc' } });
  console.log(`📚 Seeded ${books.length} curated books with authentic cover imagery.`);

  const genreIndex = new Map<string, Book[]>();
  for (const genre of GENRES) {
    genreIndex.set(genre, []);
  }
  for (const book of books) {
    for (const genre of book.genres) {
      const bucket = genreIndex.get(genre);
      if (!bucket) {
        genreIndex.set(genre, [book]);
      } else {
        bucket.push(book);
      }
    }
  }

  const favoritesData: { userId: number; bookId: number }[] = [];
  const reviewsData: {
    userId: number;
    bookId: number;
    rating: number;
    text: string;
    createdAt: Date;
    updatedAt: Date;
  }[] = [];

  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const user of seededUsers) {
    const focusGenres = user.favoriteGenres;
    const secondaryGenres = user.secondaryGenres ?? pickUnique(GENRES.filter((genre) => !focusGenres.includes(genre)), 2);

    const favoriteSeen = new Set<number>();
    const reviewSeen = new Set<number>();

    const focusFavorites = gatherBooksByGenres(focusGenres, genreIndex);
    const secondaryFavorites = gatherBooksByGenres(secondaryGenres, genreIndex);

    const favorites = [
      ...takeFromPool(focusFavorites, 9, favoriteSeen),
      ...takeFromPool(secondaryFavorites, 4, favoriteSeen),
    ];

    if (favorites.length < 14) {
      favorites.push(...takeFromPool(books, 14 - favorites.length, favoriteSeen));
    }

    for (const book of favorites) {
      favoritesData.push({ userId: user.id, bookId: book.id });
    }

    const reviewFocusCount = 14 + Math.floor(seededRandom() * 4);
    const reviewSecondaryCount = 8 + Math.floor(seededRandom() * 4);

    const reviewBooks = [
      ...takeFromPool(focusFavorites, reviewFocusCount, reviewSeen),
      ...takeFromPool(secondaryFavorites, reviewSecondaryCount, reviewSeen),
    ];

    if (reviewBooks.length < 26) {
      reviewBooks.push(...takeFromPool(books, 26 - reviewBooks.length, reviewSeen));
    }

    for (const book of reviewBooks) {
      const rating = ratingFor(focusGenres, book);
      const daysAgo = Math.floor(seededRandom() * 540);
      const createdAt = new Date(Date.now() - daysAgo * DAY_MS);
      const updatedAt = new Date(createdAt.getTime() + Math.floor(seededRandom() * 72) * 60 * 60 * 1000);

      reviewsData.push({
        userId: user.id,
        bookId: book.id,
        rating,
        text: buildReviewText(rating, book.title, user.name),
        createdAt,
        updatedAt,
      });
    }
  }

  await prisma.favorite.createMany({ data: favoritesData, skipDuplicates: true });
  await prisma.review.createMany({ data: reviewsData, skipDuplicates: true });

  await prisma.book.updateMany({
    data: { avgRating: 0, reviewCount: 0 },
  });

  const stats = await prisma.review.groupBy({
    by: ['bookId'],
    _avg: { rating: true },
    _count: { _all: true },
  });

  for (const stat of stats) {
    const avg = stat._avg.rating ?? 0;
    const rounded = Math.round(avg * 10) / 10;
    await prisma.book.update({
      where: { id: stat.bookId },
      data: { avgRating: rounded, reviewCount: stat._count._all },
    });
  }

  console.log(`⭐ Created ${reviewsData.length} reviews and ${favoritesData.length} favorites.`);
  console.log('✅ Seeding complete. Demo users can sign in with the shared password above.');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });