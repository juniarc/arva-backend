import { shopRepository } from '../repositories/shop.repository.js';

const CACHE_TTL_MS = 60 * 1000;

let cache: { cities: string[]; expiresAt: number } | null = null;

// Distinct cities of shops with active products, sorted A to Z ignoring case.
// Cached in this process for 60 seconds. The list changes rarely, and each server
// instance keeps its own copy, so a new city can take up to a minute to show up.
async function getCities(): Promise<{ cities: string[] }> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return { cities: cache.cities };
  }

  const cities = [...new Set(await shopRepository.findCitiesWithActiveProducts())].sort(
    (a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }) || a.localeCompare(b, 'en'),
  );
  cache = { cities, expiresAt: now + CACHE_TTL_MS };
  return { cities };
}

// For tests: forget the cached list.
function clearCache(): void {
  cache = null;
}

export const productCityService = { getCities, clearCache };
