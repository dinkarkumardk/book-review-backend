import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const books = await prisma.book.findMany({ take: 20, orderBy: { id: 'asc' } });
  for (const b of books) {
    console.log(`${b.id}: ${String(b.coverImageURL)}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
