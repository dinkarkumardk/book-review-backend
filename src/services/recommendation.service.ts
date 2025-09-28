import { PrismaClient, Book } from '../generated/prisma';

const prisma = new PrismaClient();

export async function getHybridRecommendations(userId: number | undefined, limit = 10): Promise<Book[]> {
  // If no user, fall back to top-rated
  if (!userId) {
    return prisma.book.findMany({
      orderBy: [ { avgRating: 'desc' }, { reviewCount: 'desc' } ],
      take: limit,
    });
  }
  // Collect favorite genres
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    include: { book: true },
  });
  const genreCounts: Record<string, number> = {};
  favorites.forEach(fav => {
    fav.book.genres.forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
  });
  const favoriteGenres = Object.entries(genreCounts)
    .sort((a,b) => b[1]-a[1])
    .map(([g]) => g)
    .slice(0,3);

  if (favoriteGenres.length === 0) {
    // fallback to top rated
    return prisma.book.findMany({
      orderBy: [ { avgRating: 'desc' }, { reviewCount: 'desc' } ],
      take: limit,
    });
  }
  // Get genre-matched books ordered by rating
  const genreBooks = await prisma.book.findMany({
    where: { genres: { hasSome: favoriteGenres } },
    orderBy: [ { avgRating: 'desc' }, { reviewCount: 'desc' } ],
    take: limit * 2,
  });

  // Deduplicate and slice
  const seen = new Set<number>();
  const combined: Book[] = [];
  for (const b of genreBooks) {
    if (!seen.has(b.id)) { seen.add(b.id); combined.push(b); }
    if (combined.length >= limit) break;
  }
  if (combined.length < limit) {
    const topRated = await prisma.book.findMany({
      orderBy: [ { avgRating: 'desc' }, { reviewCount: 'desc' } ],
      take: limit * 2,
    });
    for (const b of topRated) {
      if (!seen.has(b.id)) { seen.add(b.id); combined.push(b); }
      if (combined.length >= limit) break;
    }
  }
  return combined.slice(0, limit);
}
