// Product photos are checked by their first bytes, not by the file name or the type the browser
// claims. Only JPEG, PNG and WebP are accepted.

export type ImageKind = 'jpg' | 'png' | 'webp';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_PRODUCT_IMAGES = 5;

export function detectImageKind(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= png.length && png.every((byte, index) => bytes[index] === byte)) {
    return 'png';
  }
  // "RIFF" .... "WEBP"
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    return 'webp';
  }
  return null;
}
