// A small subset of the Indonesian region hierarchy, for development and tests.
// Ids are the wilayah.id codes without dots (https://wilayah.id), the same codes the frontend
// sends: province 2 digits ("31"), city 4 ("3171"), district 6 ("317107"), sub-district 10
// ("3171071001"). Each code starts with its parent's code. Names are copied from wilayah.id
// (data updated 2025-07-04). The full list is loaded with `npm run db:import-regions`.
import type { PrismaClient } from '@prisma/client';

interface NamedCode {
  code: string;
  name: string;
}

interface RegionTree extends NamedCode {
  cities: (NamedCode & {
    districts: (NamedCode & { subDistricts: NamedCode[] })[];
  })[];
}

export const regionTree: RegionTree[] = [
  {
    code: '31',
    name: 'DKI Jakarta',
    cities: [
      {
        code: '3174',
        name: 'Kota Administrasi Jakarta Selatan',
        districts: [
          {
            code: '317401',
            name: 'Tebet',
            subDistricts: [
              { code: '3174011001', name: 'Tebet Timur' },
              { code: '3174011002', name: 'Tebet Barat' },
              { code: '3174011003', name: 'Menteng Dalam' },
              { code: '3174011004', name: 'Kebon Baru' },
              { code: '3174011005', name: 'Bukit Duri' },
              { code: '3174011006', name: 'Manggarai Selatan' },
              { code: '3174011007', name: 'Manggarai' },
            ],
          },
          {
            code: '317407',
            name: 'Kebayoran Baru',
            subDistricts: [
              { code: '3174071001', name: 'Melawai' },
              { code: '3174071002', name: 'Gunung' },
              { code: '3174071003', name: 'Kramat Pela' },
              { code: '3174071004', name: 'Selong' },
              { code: '3174071005', name: 'Rawa Barat' },
              { code: '3174071006', name: 'Senayan' },
              { code: '3174071007', name: 'Pulo' },
              { code: '3174071008', name: 'Petogogan' },
              { code: '3174071009', name: 'Gandaria Utara' },
              { code: '3174071010', name: 'Cipete Utara' },
            ],
          },
        ],
      },
      {
        code: '3171',
        name: 'Kota Administrasi Jakarta Pusat',
        districts: [
          {
            code: '317101',
            name: 'Gambir',
            subDistricts: [
              { code: '3171011001', name: 'Gambir' },
              { code: '3171011002', name: 'Cideng' },
              { code: '3171011003', name: 'Petojo Utara' },
              { code: '3171011004', name: 'Petojo Selatan' },
              { code: '3171011005', name: 'Kebon Kelapa' },
              { code: '3171011006', name: 'Duri Pulo' },
            ],
          },
          {
            code: '317106',
            name: 'Menteng',
            subDistricts: [
              { code: '3171061001', name: 'Menteng' },
              { code: '3171061002', name: 'Pegangsaan' },
              { code: '3171061003', name: 'Cikini' },
              { code: '3171061004', name: 'Gondangdia' },
              { code: '3171061005', name: 'Kebon Sirih' },
            ],
          },
          {
            code: '317107',
            name: 'Tanah Abang',
            subDistricts: [
              { code: '3171071001', name: 'Gelora' },
              { code: '3171071002', name: 'Bendungan Hilir' },
              { code: '3171071003', name: 'Karet Tengsin' },
              { code: '3171071004', name: 'Petamburan' },
              { code: '3171071005', name: 'Kebon Melati' },
              { code: '3171071006', name: 'Kebon Kacang' },
              { code: '3171071007', name: 'Kampung Bali' },
            ],
          },
        ],
      },
    ],
  },
  {
    code: '32',
    name: 'Jawa Barat',
    cities: [
      {
        code: '3273',
        name: 'Kota Bandung',
        districts: [
          {
            code: '327302',
            name: 'Coblong',
            subDistricts: [
              { code: '3273021001', name: 'Cipaganti' },
              { code: '3273021002', name: 'Lebak Gede' },
              { code: '3273021003', name: 'Sadang Serang' },
              { code: '3273021004', name: 'Dago' },
              { code: '3273021005', name: 'Sekeloa' },
              { code: '3273021006', name: 'Lebak Siliwangi' },
            ],
          },
          {
            code: '327306',
            name: 'Cicendo',
            subDistricts: [
              { code: '3273061001', name: 'Husein Sastranegara' },
              { code: '3273061002', name: 'Arjuna' },
              { code: '3273061003', name: 'Pajajaran' },
              { code: '3273061004', name: 'Pasirkaliki' },
              { code: '3273061005', name: 'Pamoyanan' },
              { code: '3273061006', name: 'Sukaraja' },
            ],
          },
        ],
      },
      {
        code: '3201',
        name: 'Kabupaten Bogor',
        districts: [
          {
            code: '320101',
            name: 'Cibinong',
            subDistricts: [
              { code: '3201011001', name: 'Pondok Rajeg' },
              { code: '3201011002', name: 'Karadenan' },
              { code: '3201011003', name: 'Harapanjaya' },
              { code: '3201011004', name: 'Nanggewer' },
              { code: '3201011005', name: 'Nanggewer Mekar' },
              { code: '3201011006', name: 'Cibinong' },
              { code: '3201011007', name: 'Pakansari' },
              { code: '3201011008', name: 'Tengah' },
              { code: '3201011009', name: 'Sukahati' },
              { code: '3201011010', name: 'Ciriung' },
              { code: '3201011011', name: 'Cirimekar' },
              { code: '3201011012', name: 'Pabuaran' },
              { code: '3201011013', name: 'Pabuaran Mekar' },
            ],
          },
          {
            code: '320107',
            name: 'Cileungsi',
            subDistricts: [
              { code: '3201072001', name: 'Pasirangin' },
              { code: '3201072002', name: 'Mekarsari' },
              { code: '3201072003', name: 'Mampir' },
              { code: '3201072004', name: 'Dayeuh' },
              { code: '3201072005', name: 'Gandoang' },
              { code: '3201072006', name: 'Jatisari' },
              { code: '3201072007', name: 'Cileungsi Kidul' },
              { code: '3201072008', name: 'Cipeucang' },
              { code: '3201072009', name: 'Situsari' },
              { code: '3201072010', name: 'Cipenjo' },
              { code: '3201072011', name: 'Limusnunggal' },
              { code: '3201072012', name: 'Cileungsi' },
            ],
          },
        ],
      },
    ],
  },
  {
    code: '51',
    name: 'Bali',
    cities: [
      {
        code: '5171',
        name: 'Kota Denpasar',
        districts: [
          {
            code: '517101',
            name: 'Denpasar Selatan',
            subDistricts: [
              { code: '5171011001', name: 'Serangan' },
              { code: '5171011002', name: 'Pedungan' },
              { code: '5171011003', name: 'Sesetan' },
              { code: '5171011004', name: 'Panjer' },
              { code: '5171011005', name: 'Renon' },
              { code: '5171011006', name: 'Sanur' },
              { code: '5171012007', name: 'Sidakarya' },
              { code: '5171012008', name: 'Pemogan' },
              { code: '5171012009', name: 'Sanur Kaja' },
              { code: '5171012010', name: 'Sanur Kauh' },
            ],
          },
          {
            code: '517103',
            name: 'Denpasar Barat',
            subDistricts: [
              { code: '5171031005', name: 'Dauh Puri' },
              { code: '5171031007', name: 'Pemecutan' },
              { code: '5171031010', name: 'Padangsambian' },
              { code: '5171032001', name: 'Padangsambian Kelod' },
              { code: '5171032002', name: 'Pemecutan Kelod' },
              { code: '5171032003', name: 'Dauh Puri Kauh' },
              { code: '5171032004', name: 'Dauh Puri Kelod' },
              { code: '5171032006', name: 'Dauh Puri Kangin' },
              { code: '5171032008', name: 'Tegal Harum' },
              { code: '5171032009', name: 'Tegal Kertha' },
              { code: '5171032011', name: 'Padang Sambian Kaja' },
            ],
          },
        ],
      },
    ],
  },
];

export interface RegionRows {
  provinces: { id: string; name: string }[];
  cities: { id: string; provinceId: string; name: string }[];
  districts: { id: string; cityId: string; name: string }[];
  subDistricts: { id: string; districtId: string; name: string }[];
}

export function flattenRegions(tree: RegionTree[] = regionTree): RegionRows {
  const rows: RegionRows = { provinces: [], cities: [], districts: [], subDistricts: [] };

  for (const province of tree) {
    rows.provinces.push({ id: province.code, name: province.name });
    for (const city of province.cities) {
      rows.cities.push({ id: city.code, provinceId: province.code, name: city.name });
      for (const district of city.districts) {
        rows.districts.push({ id: district.code, cityId: city.code, name: district.name });
        for (const subDistrict of district.subDistricts) {
          rows.subDistricts.push({ id: subDistrict.code, districtId: district.code, name: subDistrict.name });
        }
      }
    }
  }
  return rows;
}

// Safe to run many times: every row is upserted by its code. Parents are written before children.
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
