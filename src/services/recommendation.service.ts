import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function uniqPush<T extends { id: number }>(dest: T[], source: T[], seen: Set<number>, limit: number) {
  for (const item of source) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    dest.push(item);
    if (dest.length >= limit) break;
  }
}

export async function getHybridRecommendations(userId: number | undefined, limit = 10) {
  // If no user, fall back to top-rated
  if (!userId) {
    const [recentlyPopular, evergreenClassics] = await Promise.all([
      prisma.book.findMany({
        orderBy: [
          { publishedYear: 'desc' },
          { avgRating: 'desc' },
          { reviewCount: 'desc' },
        ],
        take: limit * 2,
      }),
      prisma.book.findMany({
        orderBy: [ { reviewCount: 'desc' }, { avgRating: 'desc' } ],
        take: limit * 2,
      }),
    ]);

    const result: typeof recentlyPopular = [];
    const seen = new Set<number>();

    for (let i = 0; i < Math.max(recentlyPopular.length, evergreenClassics.length); i += 1) {
      const pick = i % 2 === 0 ? recentlyPopular[i] : evergreenClassics[i];
      if (pick && !seen.has(pick.id)) {
        seen.add(pick.id);
        result.push(pick);
      }
      if (result.length >= limit * 2) {
        break;
      }
    }

    if (result.length < limit * 2) {
      const filler = await prisma.book.findMany({
        orderBy: [ { avgRating: 'desc' } ],
        take: limit * 2,
      });
      for (const book of filler) {
        if (!seen.has(book.id)) {
          seen.add(book.id);
          result.push(book);
        }
        if (result.length >= limit * 2) {
          break;
        }
      }
    }

    return result.slice(0, limit);
  }
  // Collect favorite genres
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    include: { book: true },
  });
  const favoriteIds = favorites.map((fav) => fav.bookId);
  const favoriteIdSet = new Set<number>(favoriteIds);

  const genreCounts: Record<string, number> = {};
  favorites.forEach((fav: any) => {
    const genres: string[] = Array.isArray(fav.book?.genres) ? fav.book.genres : [];
    genres.forEach((g: string) => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
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
  const recommendations: any[] = [];
  const seen = new Set<number>(favoriteIdSet);

  const genreBooks = await prisma.book.findMany({
    where: {
      genres: { hasSome: favoriteGenres },
      id: favoriteIds.length ? { notIn: favoriteIds } : undefined,
    },
    orderBy: [ { avgRating: 'desc' }, { reviewCount: 'desc' } ],
    take: limit * 3,
  });
  uniqPush(recommendations, genreBooks, seen, limit);

  if (recommendations.length < limit) {
    const recentPopular = await prisma.book.findMany({
      where: { id: { notIn: Array.from(seen) } },
      orderBy: [ { publishedYear: 'desc' }, { reviewCount: 'desc' } ],
      take: limit * 2,
    });
    uniqPush(recommendations, recentPopular, seen, limit);
  }

  if (recommendations.length < limit) {
    const topRated = await prisma.book.findMany({
      where: { id: { notIn: Array.from(seen) } },
      orderBy: [ { avgRating: 'desc' }, { reviewCount: 'desc' } ],
      take: limit * 2,
    });
    uniqPush(recommendations, topRated, seen, limit);
  }

  if (recommendations.length < limit) {
    const fallback = await prisma.book.findMany({
      where: { id: { notIn: Array.from(seen) } },
      take: limit * 2,
    });
    uniqPush(recommendations, fallback, seen, limit);
  }

  return recommendations.slice(0, limit);
}

export async function getTopRatedRecommendations(limit = 10) {
  return prisma.book.findMany({
    orderBy: [ { avgRating: 'desc' }, { reviewCount: 'desc' } ],
    take: limit,
  });
}

