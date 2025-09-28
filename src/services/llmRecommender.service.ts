import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

// Placeholder implementation: in future call OpenAI / embeddings etc.
export async function getLLMBookRecommendations(userId: number | undefined, limit = 10) {
	// For now reuse hybrid recommendations logic by ranking recent popular books with description length heuristic.
	// This is just a stub so product can swap in real LLM logic later.
	const books = await prisma.book.findMany({
		orderBy: [ { avgRating: 'desc' }, { reviewCount: 'desc' } ],
		take: limit * 2,
	});
	return books.slice(0, limit);
}
