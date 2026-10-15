import { NotFoundError } from '../lib/errors.js';
import { createTtlCache } from '../lib/ttl-cache.js';
import { regionRepository, type RegionRecord } from '../repositories/region.repository.js';

const ONE_HOUR_MS = 60 * 60 * 1000;

export interface RegionListResponse {
  items: { id: string; name: string }[];
}

// Region data changes almost never, so each list is cached for an hour in this process.
// Unknown parents (404) are not cached.
const cache = createTtlCache<RegionListResponse>(ONE_HOUR_MS);

function toResponse(records: RegionRecord[]): RegionListResponse {
  return { items: records.map((record) => ({ id: record.id, name: record.name })) };
}

async function cached(
  key: string,
  load: () => Promise<RegionRecord[] | null>,
  notFoundMessage: string,
): Promise<RegionListResponse> {
  const result = await cache.getOrLoad(key, async () => {
    const records = await load();
    return records === null ? null : toResponse(records);
  });
  if (result === null) {
    throw new NotFoundError(notFoundMessage);
  }
  return result;
}

const listProvinces = () => cached('provinces', regionRepository.listProvinces, 'Province not found.');

const listCities = (provinceId: string) =>
  cached(`cities:${provinceId}`, () => regionRepository.listCities(provinceId), 'Province not found.');

const listDistricts = (cityId: string) =>
  cached(`districts:${cityId}`, () => regionRepository.listDistricts(cityId), 'City not found.');

const listSubDistricts = (districtId: string) =>
  cached(
    `sub-districts:${districtId}`,
    () => regionRepository.listSubDistricts(districtId),
    'District not found.',
  );

// For tests: forget every cached list.
function clearCache(): void {
  cache.clear();
}

export const regionService = { listProvinces, listCities, listDistricts, listSubDistricts, clearCache };
