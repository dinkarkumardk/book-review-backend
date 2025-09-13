import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function getFetch() {
  if (typeof (globalThis as any).fetch === 'function') {
    return (globalThis as any).fetch.bind(globalThis);
  }
  const mod = await import('node-fetch');
  return (mod as any).default as typeof fetch;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchCoverUrl(title: string, author?: string) {
  const fetch = await getFetch();
  try {
    const params = new URLSearchParams();
    if (title) params.set('title', title);
    if (author) params.set('author', author);
    params.set('limit', '1');

    const url = `https://openlibrary.org/search.json?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const doc = data?.docs?.[0];
    if (!doc) return null;

    if (doc.cover_i) {
      return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
    }

    const edition = (doc.edition_key && doc.edition_key[0]) || null;
    if (edition) {
      return `https://covers.openlibrary.org/b/olid/${edition}-L.jpg`;
    }

    return null;
  } catch (err) {
    console.error('fetchCoverUrl error', err);
    return null;
  }
}

async function main() {
  const books = await prisma.book.findMany();
  console.log(`Found ${books.length} books, scanning for missing coverImageURL...`);

  let updated = 0;
  for (const book of books) {
    if (book.coverImageURL) continue;

    const title = book.title || '';
    const author = book.author || '';
    console.log(`Searching cover for: "${title}" by "${author}" (id=${book.id})`);

    const cover = (await fetchCoverUrl(title, author)) || `https://picsum.photos/seed/book-${book.id}/400/600`;

    try {
      await prisma.book.update({ where: { id: book.id }, data: { coverImageURL: cover } });
      updated += 1;
      console.log(`Updated book id=${book.id} with cover: ${cover}`);
    } catch (err) {
      console.error(`Failed to update book id=${book.id}`, err);
    }

    await sleep(200);
  }

  console.log(`Done. Updated ${updated} books.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
