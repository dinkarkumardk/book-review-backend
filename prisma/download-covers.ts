import { PrismaClient } from '../src/generated/prisma';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const prisma = new PrismaClient();

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function downloadToFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (res) => {
      // Follow redirects
      if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        req.abort();
        return downloadToFile(res.headers.location as string, dest).then(resolve, reject);
      }

      if (res.statusCode && res.statusCode >= 400) {
        return reject(new Error(`Failed to download ${url}: ${res.statusCode}`));
      }

      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', (err) => reject(err));
    });
    req.on('error', reject);
  });
}

function extFromContentType(ct?: string) {
  if (!ct) return 'jpg';
  if (ct.includes('png')) return 'png';
  if (ct.includes('jpeg')) return 'jpg';
  if (ct.includes('webp')) return 'webp';
  return 'jpg';
}

async function main() {
  ensureDir(path.join(process.cwd(), 'public', 'covers'));

  const books = await prisma.book.findMany();
  console.log(`Found ${books.length} books`);

  let updated = 0;
  for (const book of books) {
    if (!book.coverImageURL) continue;
    if (book.coverImageURL.startsWith('/covers/')) continue; // already local

    try {
      // Try a HEAD request to get content-type and final URL
      const finalUrl = await new Promise<string>((resolve, reject) => {
        const client = book.coverImageURL.startsWith('https') ? https : http;
        const req = client.request(book.coverImageURL, { method: 'HEAD' }, (res) => {
          if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            resolve(res.headers.location as string);
          } else {
            resolve(book.coverImageURL);
          }
        });
        req.on('error', reject);
        req.end();
      });

      // determine extension via simple heuristic using path or HEAD content-type
      let ext = path.extname(new URL(finalUrl).pathname).replace('.', '');
      if (!ext) {
        // fallback to GET and inspect content-type
        const ct = await new Promise<string | undefined>((resolve) => {
          const client = finalUrl.startsWith('https') ? https : http;
          const r = client.request(finalUrl, { method: 'GET' }, (res) => {
            resolve(res.headers['content-type'] as string | undefined);
            res.destroy();
          });
          r.on('error', () => resolve(undefined));
          r.end();
        });
        ext = extFromContentType(ct);
      }

      const filename = `book-${book.id}.${ext}`;
      const dest = path.join(process.cwd(), 'public', 'covers', filename);

      await downloadToFile(finalUrl, dest).catch(async (err) => {
        console.warn(`Primary download failed for book ${book.id}, retrying with original URL...`, err.message);
        // try original URL
        await downloadToFile(book.coverImageURL as string, dest);
      });

      const localUrl = `/covers/${filename}`;
      await prisma.book.update({ where: { id: book.id }, data: { coverImageURL: localUrl } });
      updated += 1;
      console.log(`Book ${book.id} cover saved to ${localUrl}`);
    } catch (err) {
      console.error(`Failed to process book ${book.id}`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`Done. Updated ${updated} book records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
