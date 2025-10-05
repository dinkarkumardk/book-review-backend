const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const res = await prisma.book.groupBy({
    by: ['author'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10
  });
  console.log('Top authors by number of books:');
  res.forEach((item, index) => {
    console.log(`${index + 1}. ${item.author}: ${item._count.id} books`);
  });
  await prisma.$disconnect();
})().catch(console.error);