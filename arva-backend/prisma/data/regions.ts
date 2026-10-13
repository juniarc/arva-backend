// A small subset of the Indonesian region hierarchy, for development and tests.
// The full list is loaded later from a data source chosen by the project.
//
// Ids are assigned from the order in this file (1, 2, 3 ... in each table), so they stay stable
// between runs. Only add new entries at the END of a list, or the ids of later entries shift.
import type { PrismaClient } from '@prisma/client';

interface RegionTree {
  province: string;
  cities: {
    name: string;
    districts: { name: string; subDistricts: string[] }[];
  }[];
}

export const regionTree: RegionTree[] = [
  {
    province: 'DKI Jakarta',
    cities: [
      {
        name: 'Jakarta Selatan',
        districts: [
          { name: 'Kebayoran Baru', subDistricts: ['Gunung', 'Senayan', 'Melawai'] },
          { name: 'Tebet', subDistricts: ['Tebet Barat', 'Tebet Timur'] },
        ],
      },
      {
        name: 'Jakarta Pusat',
        districts: [
          { name: 'Menteng', subDistricts: ['Menteng', 'Pegangsaan'] },
          { name: 'Gambir', subDistricts: ['Gambir', 'Petojo Selatan'] },
        ],
      },
    ],
  },
  {
    province: 'Jawa Barat',
    cities: [
      {
        name: 'Kota Bandung',
        districts: [
          { name: 'Coblong', subDistricts: ['Dago', 'Lebak Siliwangi'] },
          { name: 'Cicendo', subDistricts: ['Arjuna', 'Husein Sastranegara'] },
        ],
      },
      {
        name: 'Kabupaten Bogor',
        districts: [
          { name: 'Cibinong', subDistricts: ['Pakansari', 'Harapan Jaya'] },
          { name: 'Cileungsi', subDistricts: ['Cileungsi', 'Limusnunggal'] },
        ],
      },
    ],
  },
  {
    province: 'Bali',
    cities: [
      {
        name: 'Kota Denpasar',
        districts: [
          { name: 'Denpasar Selatan', subDistricts: ['Sanur', 'Pedungan'] },
          { name: 'Denpasar Barat', subDistricts: ['Pemecutan', 'Dauh Puri'] },
        ],
      },
    ],
  },
];

export interface RegionRows {
  provinces: { id: number; name: string }[];
  cities: { id: number; provinceId: number; name: string }[];
  districts: { id: number; cityId: number; name: string }[];
  subDistricts: { id: number; districtId: number; name: string }[];
}

export function flattenRegions(tree: RegionTree[] = regionTree): RegionRows {
  const rows: RegionRows = { provinces: [], cities: [], districts: [], subDistricts: [] };

  for (const province of tree) {
    const provinceId = rows.provinces.length + 1;
    rows.provinces.push({ id: provinceId, name: province.province });

    for (const city of province.cities) {
      const cityId = rows.cities.length + 1;
      rows.cities.push({ id: cityId, provinceId, name: city.name });

      for (const district of city.districts) {
        const districtId = rows.districts.length + 1;
        rows.districts.push({ id: districtId, cityId, name: district.name });

        for (const name of district.subDistricts) {
          rows.subDistricts.push({ id: rows.subDistricts.length + 1, districtId, name });
        }
      }
    }
  }
  return rows;
}

// Safe to run many times: every row is upserted by its id. Parents are written before children.
export async function seedRegions(prisma: PrismaClient): Promise<Record<keyof RegionRows, number>> {
  const rows = flattenRegions();

  for (const { id, ...fields } of rows.provinces) {
    await prisma.province.upsert({ where: { id }, create: { id, ...fields }, update: fields });
  }
  for (const { id, ...fields } of rows.cities) {
    await prisma.city.upsert({ where: { id }, create: { id, ...fields }, update: fields });
  }
  for (const { id, ...fields } of rows.districts) {
    await prisma.district.upsert({ where: { id }, create: { id, ...fields }, update: fields });
  }
  for (const { id, ...fields } of rows.subDistricts) {
    await prisma.subDistrict.upsert({ where: { id }, create: { id, ...fields }, update: fields });
  }

  return {
    provinces: rows.provinces.length,
    cities: rows.cities.length,
    districts: rows.districts.length,
    subDistricts: rows.subDistricts.length,
  };
}
