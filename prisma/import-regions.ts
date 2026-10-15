// Loads the full Indonesian region list from wilayah.id into the region tables.
// The seed only has a small subset. Run this once per database (it takes a few minutes and makes
// about 8,000 requests to wilayah.id):
//
//   npm run db:import-regions                      # everything
//   npm run db:import-regions -- --province=31     # one province only
//   npm run db:import-regions -- --dry-run         # fetch and count, write nothing
//
// Safe to run again: provinces and cities are upserted (names are refreshed), districts and
// sub-districts that already exist are skipped. Codes are stored without dots ("31.71" -> "3171").
import { PrismaClient } from '@prisma/client';

const API = 'https://wilayah.id/api';
const CONCURRENCY = 6;
const RETRIES = 3;

interface Region {
  // Without dots, as stored: "3171".
  code: string;
  // With dots, as wilayah.id paths need it: "31.71".
  apiCode: string;
  name: string;
}

interface Options {
  dryRun: boolean;
  province: string | null;
}

function readOptions(argv: string[]): Options {
  const province = argv.find((arg) => arg.startsWith('--province='))?.split('=')[1] ?? null;
  if (province !== null && !/^\d{2}$/.test(province)) {
    throw new Error('--province must be a 2 digit code, for example --province=31');
  }
  return { dryRun: argv.includes('--dry-run'), province };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRegionList(value: unknown): value is { data: { code: string; name: string }[] } {
  if (typeof value !== 'object' || value === null || !('data' in value) || !Array.isArray(value.data)) {
    return false;
  }
  return value.data.every(
    (item: unknown) =>
      typeof item === 'object' &&
      item !== null &&
      'code' in item &&
      'name' in item &&
      typeof item.code === 'string' &&
      typeof item.name === 'string',
  );
}

// "31.71" -> "3171", and names are trimmed (some wilayah.id names end with a space).
async function fetchRegions(path: string): Promise<Region[]> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(`${API}/${path}.json`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const body: unknown = await response.json();
      if (!isRegionList(body)) {
        throw new Error('unexpected response shape');
      }
      return body.data.map((region) => ({
        code: region.code.replaceAll('.', ''),
        apiCode: region.code,
        name: region.name.trim(),
      }));
    } catch (error) {
      if (attempt >= RETRIES) {
        throw new Error(`Could not load ${path}: ${error instanceof Error ? error.message : String(error)}`);
      }
      await wait(1000 * attempt);
    }
  }
}

// Runs `work` for every item, at most CONCURRENCY at a time.
async function forEachLimited<T>(items: T[], work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      if (item !== undefined) {
        await work(item);
      }
    }
  });
  await Promise.all(workers);
}

async function main(): Promise<void> {
  const options = readOptions(process.argv.slice(2));
  const prisma = new PrismaClient();
  const counts = { provinces: 0, cities: 0, districts: 0, subDistricts: 0 };

  try {
    const provinces = (await fetchRegions('provinces')).filter(
      (province) => options.province === null || province.code === options.province,
    );

    for (const province of provinces) {
      counts.provinces += 1;
      if (!options.dryRun) {
        await prisma.province.upsert({
          where: { id: province.code },
          create: { id: province.code, name: province.name },
          update: { name: province.name },
        });
      }

      const cities = await fetchRegions(`regencies/${province.apiCode}`);
      counts.cities += cities.length;
      for (const city of cities) {
        if (!options.dryRun) {
          await prisma.city.upsert({
            where: { id: city.code },
            create: { id: city.code, provinceId: province.code, name: city.name },
            update: { name: city.name },
          });
        }
      }

      await forEachLimited(cities, async (city) => {
        const districts = await fetchRegions(`districts/${city.apiCode}`);
        counts.districts += districts.length;
        if (!options.dryRun) {
          await prisma.district.createMany({
            data: districts.map((district) => ({ id: district.code, cityId: city.code, name: district.name })),
            skipDuplicates: true,
          });
        }

        for (const district of districts) {
          const villages = await fetchRegions(`villages/${district.apiCode}`);
          counts.subDistricts += villages.length;
          if (!options.dryRun) {
            await prisma.subDistrict.createMany({
              data: villages.map((village) => ({ id: village.code, districtId: district.code, name: village.name })),
              skipDuplicates: true,
            });
          }
        }
      });

      console.log(`  ${province.code} ${province.name}: done`);
    }

    console.log(options.dryRun ? 'Dry run (nothing written):' : 'Regions imported:');
    console.log(`  provinces:     ${counts.provinces}`);
    console.log(`  cities:        ${counts.cities}`);
    console.log(`  districts:     ${counts.districts}`);
    console.log(`  sub-districts: ${counts.subDistricts}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Region import failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
