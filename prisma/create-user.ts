import { PrismaClient } from '../src/generated/prisma';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'dinkar.kumar@talentica.com';
  const name = 'Dinkar Kumar';
  const password = 'ChangeMe123!'; // You can change this after first login

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User already exists with id=${existing.id}, email=${email}`);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, hashedPassword }
  });
  console.log('Created user:', { id: user.id, email: user.email, password });
  console.log('NOTE: Store the password securely and rotate it if needed.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
