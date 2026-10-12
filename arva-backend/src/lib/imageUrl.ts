import { env } from './env.js';

// Turns a stored image path into the URL the API returns.
// A full http(s) URL is returned unchanged. A path such as /images/dummy/x.jpg gets
// IMAGE_BASE_URL in front of it when that is set, and is returned as is otherwise.
export function toImageUrl(storedPath: string, baseUrl: string | undefined = env.IMAGE_BASE_URL): string {
  if (/^https?:\/\//i.test(storedPath) || !baseUrl) {
    return storedPath;
  }
  const path = storedPath.startsWith('/') ? storedPath : `/${storedPath}`;
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}
