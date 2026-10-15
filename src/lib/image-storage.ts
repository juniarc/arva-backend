import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from './env.js';
import type { ImageKind } from './image-file.js';

// Product photos are stored on this server's disk, in UPLOAD_DIR/products, and served by app.ts at
// /uploads. A production setup would use object storage; this module is the one place to change.

const FOLDER = 'products';

function publicBaseUrl(): string {
  return (env.UPLOAD_BASE_URL ?? `http://localhost:${env.PORT}`).replace(/\/+$/, '');
}

const STORED_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

// Deletes photos this module stored, after their product (or the photo) was removed. A URL that
// is not one of ours (for example a seeded /images/dummy/ photo) is left alone, and so is any name
// that does not look like one we wrote: nothing outside the upload folder can be touched.
// The path decides, not the host: a photo saved while the API ran on another address is still found.
export async function removeStoredImages(urls: string[]): Promise<void> {
  const prefix = `/uploads/${FOLDER}/`;
  const directory = path.resolve(env.UPLOAD_DIR, FOLDER);
  const pathOf = (url: string) => {
    try {
      return new URL(url).pathname;
    } catch {
      return '';
    }
  };
  const files = urls
    .map(pathOf)
    .filter((pathname) => pathname.startsWith(prefix))
    .map((pathname) => pathname.slice(prefix.length))
    .filter((name) => STORED_NAME.test(name))
    .map((name) => path.join(directory, name));
  await Promise.all(files.map((file) => unlink(file).catch(() => undefined)));
}

export interface StoredImages {
  urls: string[];
  // Deletes the files again, for a product that could not be saved.
  remove: () => Promise<void>;
}

// Each file gets a random name: nothing from the user's file name reaches the disk.
export async function storeImages(images: { bytes: Buffer; kind: ImageKind }[]): Promise<StoredImages> {
  const directory = path.resolve(env.UPLOAD_DIR, FOLDER);
  await mkdir(directory, { recursive: true });

  const written: string[] = [];
  const remove = async () => {
    await Promise.all(written.map((file) => unlink(file).catch(() => undefined)));
  };

  try {
    const urls: string[] = [];
    for (const image of images) {
      const name = `${randomUUID()}.${image.kind}`;
      const file = path.join(directory, name);
      await writeFile(file, image.bytes, { flag: 'wx' });
      written.push(file);
      urls.push(`${publicBaseUrl()}/uploads/${FOLDER}/${name}`);
    }
    return { urls, remove };
  } catch (error) {
    await remove();
    throw error;
  }
}
