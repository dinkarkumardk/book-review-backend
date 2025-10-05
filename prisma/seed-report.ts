import { PrismaClient } from '@prisma/client';
import { getHybridRecommendations } from '../src/services/recommendation.service';
import { getLLMBookRecommendations } from '../src/services/llmRecommender.service';

const prisma = new PrismaClient();

function percent(value: number, total: number): string {
  if (!total) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

async function summarizeGenres() {
  const books = await prisma.book.findMany({ select: { genres: true } });
  const counts = new Map<string, number>();
  for (const book of books) {
    for (const genre of book.genres) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  const total = books.length;
  const leaderboard = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([genre, count]) => ({ genre, count, coverage: percent(count, total) }));
  return { totalBooks: total, leaderboard };
}

async function getSampleUser(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: {
      favorites: {
        take: 5,
        include: { book: { select: { title: true, genres: true } } },
      },
      reviews: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { book: { select: { title: true } } },
      },
    },
  });
}

async function main() {
  const [users, books, reviews, favorites] = await Promise.all([
    prisma.user.count(),
    prisma.book.count(),
    prisma.review.count(),
    prisma.favorite.count(),
  ]);

  console.log('📊 Seed Snapshot');
  console.table([
    { entity: 'Users', total: users },
    { entity: 'Books', total: books },
    { entity: 'Reviews', total: reviews },
    { entity: 'Favorites', total: favorites },
  ]);

  const { leaderboard } = await summarizeGenres();
  console.log('\n🏷️  Top Genres (by catalog coverage)');
  console.table(leaderboard);

  const focusUserEmail = 'alice@example.com';
  const sampleUser = await getSampleUser(focusUserEmail);

  if (!sampleUser) {
    console.warn(`No user found for ${focusUserEmail}. Did the seed run?`);
    return;
  }

  console.log(`\n👤 Sample User: ${sampleUser.name} (${focusUserEmail})`);
  console.log('Favorite genres inferred from favorites:');
  const genreCounts = new Map<string, number>();
  for (const fav of sampleUser.favorites) {
    for (const genre of fav.book.genres) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
  }
  const topGenres = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre, count]) => ({ genre, count }));
  console.table(topGenres);

  const [hybrid, llm] = await Promise.all([
    getHybridRecommendations(sampleUser.id, 5),
    getLLMBookRecommendations(sampleUser.id, 5),
  ]);

  console.log('\n🤝 Hybrid Picks');
  console.table(hybrid.map((book) => ({ id: book.id, title: book.title, rating: book.avgRating, reviews: book.reviewCount })));

  console.log('\n🧠 LLM Picks (stubbed)');
  console.table(llm.map((book) => ({ id: book.id, title: book.title, rating: book.avgRating, reviews: book.reviewCount })));
}

main()
  .catch((error) => {
    console.error('❌ Failed to generate seed report', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
