const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const authorStats = await prisma.book.groupBy({
    by: ['author'],
    _count: {
      id: true,
    },
    orderBy: {
      _count: {
        id: 'desc',
      },
    },
    take: 1,
  });

  if (authorStats.length === 0) {
    console.log('No books found.');
    return;
  }

  const topAuthor = authorStats[0];
  console.log(`Author with the highest number of books: ${topAuthor.author} (${topAuthor._count.id} books)`);
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });