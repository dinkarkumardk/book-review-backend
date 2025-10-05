import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CANDIDATE_MULTIPLIER = 4;
const MIN_CANDIDATES = 30;

const LLM_PROVIDER = process.env.LLM_PROVIDER?.toLowerCase();
const HUGGINGFACE_MODEL = process.env.LLM_MODEL || 'microsoft/Phi-3-mini-4k-instruct';
const HUGGINGFACE_API_KEY = process.env.LLM_API_KEY;
const HUGGINGFACE_BASE_URL = process.env.LLM_API_URL || `https://api-inference.huggingface.co/models/${HUGGINGFACE_MODEL}`;
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 4000);
const ENABLE_HUGGINGFACE = LLM_PROVIDER === 'huggingface' && !!HUGGINGFACE_API_KEY;

type WeightedMap = Map<string, number>;
type LLMRankingEntry = {
	id?: number | string;
	bookId?: number | string;
	title?: string;
	reason?: string;
	explanation?: string;
};

function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((token) => token.length >= 4 && token.length <= 30);
}

function seededRandom(seed: string): number {
	let hash = 0;
	for (let i = 0; i < seed.length; i += 1) {
		hash = Math.imul(31, hash) + seed.charCodeAt(i);
		hash |= 0;
	}
	return ((hash >>> 0) % 1000) / 1000;
}

function topKeys(weights: WeightedMap, limit: number): string[] {
	return [...weights.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([key]) => key);
}

function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}
	return `${text.slice(0, maxLength - 3)}...`;
}

async function callHuggingFaceRanking(options: {
	limit: number;
	books: Array<{
		id: number;
		title: string;
		author: string;
		genres: string[];
		description: string;
		avgRating: number;
		reviewCount: number;
	}>;
	profileSummary: string;
}): Promise<{ order: number[]; reasons: Map<number, string> } | null> {
	if (!ENABLE_HUGGINGFACE) {
		return null;
	}

	const { limit, books, profileSummary } = options;
	const bookLines = books
		.map((book) => {
			const genres = book.genres.length ? book.genres.slice(0, 4).join(', ') : 'unknown';
			const synopsis = truncate(book.description || 'No description available.', 320).replace(/\s+/g, ' ').trim();
			return `{
	  "id": ${book.id},
	  "title": "${book.title.replace(/"/g, '\\"')}",
	  "author": "${book.author.replace(/"/g, '\\"')}",
	  "genres": "${genres.replace(/"/g, '\\"')}",
	  "avgRating": ${book.avgRating.toFixed(2)},
	  "reviewCount": ${book.reviewCount},
	  "summary": "${synopsis.replace(/"/g, '\\"')}"
}`;
		})
		.join(',\n');

	const instructions = `You are BookVerse's AI librarian. Choose the top ${limit} books that best match the reader profile. Respond ONLY with a JSON array. Each array item must be an object with fields: id (number), title (string), and reason (brief string explaining the match). Do not include extra commentary.`;
	const prompt = `${instructions}\n\nReader profile:\n${profileSummary}\n\nCandidate books (JSON objects):\n[\n${bookLines}\n]\n\nReturn a JSON array sorted from best to worst recommendation.`;

	const body = {
		inputs: prompt,
		parameters: {
			max_new_tokens: 420,
			temperature: 0.2,
			top_p: 0.9,
			return_full_text: false,
		},
		options: {
			wait_for_model: true,
		},
	};

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

	try {
		const response = await fetch(HUGGINGFACE_BASE_URL, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
			signal: controller.signal,
		});
		clearTimeout(timeout);

		if (!response.ok) {
			throw new Error(`Hugging Face responded with status ${response.status}`);
		}

		const payload = await response.json();
		let rawText = '';
		if (Array.isArray(payload)) {
			const first = payload[0];
			if (typeof first === 'string') {
				rawText = first;
			} else if (first?.generated_text) {
				rawText = first.generated_text;
			} else if (first?.text) {
				rawText = first.text;
			}
		} else if (payload?.generated_text) {
			rawText = payload.generated_text;
		} else if (payload?.text) {
			rawText = payload.text;
		}

		if (!rawText) {
			rawText = JSON.stringify(payload);
		}

		const match = rawText.match(/\[[\s\S]*\]/);
		if (!match) {
			throw new Error('Could not locate JSON array in LLM response');
		}
		const parsed = JSON.parse(match[0]) as LLMRankingEntry[];
		if (!Array.isArray(parsed)) {
			throw new Error('LLM response did not parse into an array');
		}

		const reasons = new Map<number, string>();
		const order: number[] = [];
		const titleIndex = new Map<string, number>();
		books.forEach((book) => {
			titleIndex.set(book.title.toLowerCase(), book.id);
		});

		parsed.forEach((entry) => {
			if (!entry) {
				return;
			}
			let selectedId: number | undefined;
			const candidateId = entry.id ?? entry.bookId;
			if (candidateId !== undefined) {
				const numeric = Number(candidateId);
				if (!Number.isNaN(numeric)) {
					selectedId = numeric;
				}
			}
			if (!selectedId && entry.title) {
				const lookup = titleIndex.get(String(entry.title).toLowerCase());
				if (lookup) {
					selectedId = lookup;
				}
			}
			if (typeof entry === 'string') {
				const numeric = Number(entry);
				if (!Number.isNaN(numeric)) {
					selectedId = numeric;
				}
			}
			if (typeof entry === 'number') {
				selectedId = entry;
			}
			if (selectedId !== undefined && !order.includes(selectedId)) {
				order.push(selectedId);
				const reason = entry.reason ?? entry.explanation;
				if (reason) {
					reasons.set(selectedId, String(reason));
				}
			}
		});

		return { order, reasons };
	} catch (error) {
		clearTimeout(timeout);
		console.warn('[LLM] Falling back to heuristic recommendations:', error instanceof Error ? error.message : error);
		return null;
	}
}

export async function getLLMBookRecommendations(userId: number | undefined, limit = 10) {
	const candidateTake = Math.max(limit * CANDIDATE_MULTIPLIER, MIN_CANDIDATES);
	const daySeed = new Date().toISOString().slice(0, 10); // ensures stable ordering per day
	const favoriteBookIds = new Set<number>();
	const genreWeights: WeightedMap = new Map();
	const authorWeights: WeightedMap = new Map();
	const keywordWeights: WeightedMap = new Map();
	const recentReviewTitles: string[] = [];

	if (userId) {
		const favorites = await prisma.favorite.findMany({
			where: { userId },
			include: { book: true },
			take: 25,
		});

		favorites.forEach((fav) => {
			favoriteBookIds.add(fav.bookId);
			fav.book.genres.forEach((genre) => {
				const key = genre.toLowerCase();
				genreWeights.set(key, (genreWeights.get(key) || 0) + 1);
			});
			const authorKey = fav.book.author.toLowerCase();
			authorWeights.set(authorKey, (authorWeights.get(authorKey) || 0) + 1);
			tokenize(`${fav.book.title} ${fav.book.description}`).forEach((token) => {
				keywordWeights.set(token, Math.min((keywordWeights.get(token) || 0) + 1, 5));
			});
		});

		const recentReviews = await prisma.review.findMany({
			where: { userId },
			include: { book: true },
			orderBy: { createdAt: 'desc' },
			take: 20,
		});

		recentReviews.forEach((review) => {
			recentReviewTitles.push(review.book.title);
			review.book.genres.forEach((genre) => {
				const key = genre.toLowerCase();
				genreWeights.set(key, (genreWeights.get(key) || 0) + 0.5);
			});
			const authorKey = review.book.author.toLowerCase();
			authorWeights.set(authorKey, (authorWeights.get(authorKey) || 0) + 0.5);
			tokenize(review.text).forEach((token) => {
				keywordWeights.set(token, Math.min((keywordWeights.get(token) || 0) + 0.5, 5));
			});
		});
	}

	const candidates = await prisma.book.findMany({
		take: candidateTake * 2,
		orderBy: [
			{ avgRating: 'desc' },
			{ reviewCount: 'desc' },
		],
	});

	const seen = new Set<number>();
	const scored = candidates
		.filter((book) => {
			if (seen.has(book.id)) {
				return false;
			}
			seen.add(book.id);
			return true;
		})
		.map((book) => {
			let score = book.avgRating / 5;
			score += Math.min(book.reviewCount / 500, 0.35);
			const descriptionRichness = Math.min((book.description?.length || 0) / 4000, 0.4);
			score += descriptionRichness;
			const currentYear = new Date().getFullYear();
			const recencyBoost = Math.max(0, 1 - Math.min((currentYear - book.publishedYear) / 40, 1));
			score += recencyBoost * 0.25;
			const lowerGenres = book.genres.map((g) => g.toLowerCase());
			const loweredAuthor = book.author.toLowerCase();
			const loweredDescription = (book.description || '').toLowerCase();

			if (userId) {
				const hasFavoriteGenre = lowerGenres.some((genre) => genreWeights.has(genre));
				if (hasFavoriteGenre) {
					score += 0.35;
					lowerGenres.forEach((genre) => {
						const weight = genreWeights.get(genre);
						if (weight) {
							score += Math.min(weight * 0.05, 0.25);
						}
					});
				}

				const authorWeight = authorWeights.get(loweredAuthor);
				if (authorWeight) {
					score += Math.min(authorWeight * 0.1, 0.3);
				}

				keywordWeights.forEach((weight, keyword) => {
					if (loweredDescription.includes(keyword)) {
						score += Math.min(weight * 0.03, 0.3);
					}
				});
			}

			if (userId && favoriteBookIds.has(book.id)) {
				score -= 0.5;
			}
			score += seededRandom(`${book.id}:${daySeed}`) * 0.1;

			return { book, score };
		})
		.sort((a, b) => b.score - a.score);

	const result: typeof candidates = [];
	const added = new Set<number>();
	for (const entry of scored) {
		if (userId && favoriteBookIds.has(entry.book.id)) {
			continue;
		}
		if (!added.has(entry.book.id)) {
			result.push(entry.book);
			added.add(entry.book.id);
		}
		if (result.length >= candidateTake) {
			break;
		}
	}

	if (result.length < candidateTake) {
		const fallback = await prisma.book.findMany({
			orderBy: [
				{ reviewCount: 'desc' },
				{ avgRating: 'desc' },
			],
			take: candidateTake,
		});
		for (const book of fallback) {
			if (!added.has(book.id)) {
				result.push(book);
				added.add(book.id);
			}
			if (result.length >= candidateTake) {
				break;
			}
		}
	}

	let finalList = result;

	if (ENABLE_HUGGINGFACE) {
		const favoriteGenres = topKeys(genreWeights, 5);
		const favoriteAuthors = topKeys(authorWeights, 5);
		const favoriteKeywords = topKeys(keywordWeights, 10);
		const profileSegments: string[] = [];
		if (favoriteGenres.length) {
			profileSegments.push(`Preferred genres: ${favoriteGenres.join(', ')}`);
		}
		if (favoriteAuthors.length) {
			profileSegments.push(`Frequent authors: ${favoriteAuthors.join(', ')}`);
		}
		if (favoriteKeywords.length) {
			profileSegments.push(`Notable themes/keywords: ${favoriteKeywords.join(', ')}`);
		}
		if (recentReviewTitles.length) {
			profileSegments.push(`Recently reviewed titles: ${recentReviewTitles.slice(0, 5).join(', ')}`);
		}
		if (!profileSegments.length) {
			profileSegments.push('No prior favorites or reviews. Suggest accessible, high-quality books across popular genres.');
		}

		const llmResponse = await callHuggingFaceRanking({
			limit,
			books: result.slice(0, Math.max(candidateTake, limit * 2)).map((book) => ({
				id: book.id,
				title: book.title,
				author: book.author,
				genres: book.genres,
				description: book.description || '',
				avgRating: book.avgRating,
				reviewCount: book.reviewCount,
			})),
			profileSummary: profileSegments.join('\n'),
		});

		if (llmResponse && llmResponse.order.length) {
			const orderSet = new Set<number>();
			const orderedBooks: typeof result = [];
			llmResponse.order.forEach((bookId) => {
				const match = result.find((book) => book.id === bookId);
				if (match && !orderSet.has(match.id)) {
					orderedBooks.push(match);
					orderSet.add(match.id);
				}
			});
			if (orderedBooks.length) {
				finalList = [...orderedBooks, ...result.filter((book) => !orderSet.has(book.id))];
			}
		}
	}

	return finalList.slice(0, limit);
}
