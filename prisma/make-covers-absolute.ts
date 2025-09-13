import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

const BASE = process.env.COVERS_BASE_URL || 'http://localhost:3001';

async function main() {
  const books = await prisma.book.findMany();
  let changed = 0;
  for (const b of books) {
    if (!b.coverImageURL) continue;
    if (b.coverImageURL.startsWith('http://') || b.coverImageURL.startsWith('https://')) continue;
    // only convert local /covers/ paths
    if (b.coverImageURL.startsWith('/covers/')) {
      const abs = `${BASE}${b.coverImageURL}`;
      await prisma.book.update({ where: { id: b.id }, data: { coverImageURL: abs } });
      changed += 1;
      console.log(`Book ${b.id}: ${b.coverImageURL} -> ${abs}`);
    }
  }
  console.log(`Done. Updated ${changed} books to absolute cover URLs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
