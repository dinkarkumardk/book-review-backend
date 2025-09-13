// prisma/seed.ts

import { PrismaClient } from '../src/generated/prisma';
import * as bcrypt from 'bcrypt';

// initialize Prisma Client
const prisma = new PrismaClient();

async function main() {
  // Hash passwords for the users
  const saltRounds = 10;
  const passwordAlice = await bcrypt.hash('password123', saltRounds);
  const passwordBob = await bcrypt.hash('password456', saltRounds);

  // Create or update two dummy users (idempotent)
  const user1 = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: { hashedPassword: passwordAlice, name: 'Alice' },
    create: { name: 'Alice', email: 'alice@example.com', hashedPassword: passwordAlice },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: { hashedPassword: passwordBob, name: 'Bob' },
    create: { name: 'Bob', email: 'bob@example.com', hashedPassword: passwordBob },
  });

  console.log('Created users:', { user1, user2 });

  // Create dummy books
  const books = await prisma.book.createMany({
    data: [
      {
        title: 'The Whispering Woods',
        author: 'Elara Vance',
        description: 'A fantasy novel about a hidden world in a magical forest.',
        coverImageURL: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=2787',
        genres: ['Fantasy', 'Adventure'],
        publishedYear: 2021,
      },
      {
        title: 'Cybernetic Dreams',
        author: 'Jax Cortex',
        description: 'A sci-fi thriller set in a dystopian future where AI reigns supreme.',
        coverImageURL: 'https://images.unsplash.com/photo-1518774783334-a32a62dcbf93?q=80&w=2772',
        genres: ['Science Fiction', 'Dystopian'],
        publishedYear: 2023,
      },
      {
        title: 'The Last Alchemist',
        author: 'Rena Petronis',
        description: 'A historical fiction about the quest for the philosopher\'s stone.',
        coverImageURL: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=2787',
        genres: ['Historical Fiction', 'Mystery'],
        publishedYear: 2019,
      },
      {
        title: 'Echoes of the Void',
        author: 'Kaelen Stratos',
        description: 'A space opera epic with warring galactic empires and ancient secrets.',
        coverImageURL: 'https://images.unsplash.com/photo-1588421357574-87938a86fa28?q=80&w=2835',
        genres: ['Science Fiction', 'Space Opera'],
        publishedYear: 2022,
      },
      {
        title: 'The Baker of Ginger Street',
        author: 'Penelope Crumble',
        description: 'A heartwarming tale of a small-town baker who changes lives with her recipes.',
        coverImageURL: 'https://images.unsplash.com/photo-1528745098341-2d7f5e533c6e?q=80&w=2865',
        genres: ['Contemporary', 'Fiction'],
        publishedYear: 2020,
      },
       {
        title: "The Silent Patient",
        author: "Alex Michaelides",
        description: "A shocking psychological thriller of a woman's act of violence against her husband—and of the therapist obsessed with uncovering her motive.",
        coverImageURL: "https://images.unsplash.com/photo-1589998059171-988d887df646?q=80&w=2940",
        genres: ["Thriller", "Mystery"],
        publishedYear: 2019
      },
      {
        title: "Dune",
        author: "Frank Herbert",
        description: "Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides, heir to a noble family tasked with ruling an inhospitable world where the only thing of value is the 'spice' melange, a drug capable of extending life and enhancing consciousness.",
        coverImageURL: "https://images.unsplash.com/photo-1603289983377-16cb3a6d7a17?q=80&w=2824",
        genres: ["Science Fiction", "Adventure"],
        publishedYear: 1965
      },
      {
        title: "Pride and Prejudice",
        author: "Jane Austen",
        description: "A classic novel of manners, it follows the turbulent relationship between Elizabeth Bennet, the daughter of a country gentleman, and Fitzwilliam Darcy, a rich aristocratic landowner.",
        coverImageURL: "https://images.unsplash.com/photo-1550399105-c4db5fb85c18?q=80&w=2940",
        genres: ["Classic", "Romance"],
        publishedYear: 1813
      },
      {
        title: "To Kill a Mockingbird",
        author: "Harper Lee",
        description: "The unforgettable novel of a childhood in a sleepy Southern town and the crisis of conscience that rocked it, To Kill A Mockingbird became both an instant bestseller and a critical success when it was first published in 1960.",
        coverImageURL: "https://images.unsplash.com/photo-1543002588-b9b6562934c2?q=80&w=2865",
        genres: ["Classic", "Fiction"],
        publishedYear: 1960
      },
      {
        title: "1984",
        author: "George Orwell",
        description: "A dystopian social science fiction novel and cautionary tale. It was published on 8 June 1949 by Secker & Warburg as Orwell's ninth and final book completed in his lifetime.",
        coverImageURL: "https://images.unsplash.com/photo-1516981993241-5838a393d07c?q=80&w=2865",
        genres: ["Dystopian", "Science Fiction"],
        publishedYear: 1949
      }
    ],
    skipDuplicates: true, // Optional: useful if you run the seed script multiple times
  });

  console.log(`Created ${books.count} books.`);

  // To create reviews, we need the IDs of the books we just created.
  // Let's fetch them back from the database.
  const allBooks = await prisma.book.findMany();
  
  // Create some reviews
  const review1 = await prisma.review.create({
    data: {
      rating: 5,
      text: "Absolutely captivating! A must-read for any fantasy lover.",
      userId: user1.id,
      bookId: allBooks[0].id, // The Whispering Woods
    }
  });
  
  const review2 = await prisma.review.create({
    data: {
      rating: 4,
      text: "A thrilling ride from start to finish. The world-building is incredible.",
      userId: user2.id,
      bookId: allBooks[1].id, // Cybernetic Dreams
    }
  });

  const review3 = await prisma.review.create({
    data: {
      rating: 3,
      text: "An interesting concept, but the pacing felt a bit slow in the middle.",
      userId: user1.id,
      bookId: allBooks[1].id, // Cybernetic Dreams
    }
  });

  const review4 = await prisma.review.create({
    data: {
      rating: 5,
      text: "I couldn't put it down. This is a modern classic.",
      userId: user2.id,
      bookId: allBooks[3].id, // Echoes of the Void
    }
  });

  console.log('Created reviews:', { review1, review2, review3, review4 });

  // Recalculate avgRating and reviewCount for books that have reviews
  const stats = await prisma.review.groupBy({
    by: ['bookId'],
    _avg: { rating: true },
    _count: { _all: true },
  });

  for (const s of stats) {
    const avg = s._avg.rating ?? 0;
    const rounded = Math.round(avg * 10) / 10; // one decimal place
    await prisma.book.update({
      where: { id: s.bookId },
      data: { avgRating: rounded, reviewCount: s._count._all },
    });
  }

  console.log('Recalculated book stats for seeded reviews.');
}

// execute the main function
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // close Prisma Client at the end
    await prisma.$disconnect();
  });