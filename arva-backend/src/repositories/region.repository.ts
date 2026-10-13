import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const regionSelect = { id: true, name: true } as const;
const byName = { name: 'asc' } as const;

export interface RegionRecord {
  id: string;
  name: string;
}

function listProvinces(): Promise<RegionRecord[]> {
  return prisma.province.findMany({ select: regionSelect, orderBy: byName });
}

// Each "children of" query returns null when the parent does not exist.
async function listCities(provinceId: string): Promise<RegionRecord[] | null> {
  const parent = await prisma.province.findUnique({
    where: { id: provinceId },
    select: { cities: { select: regionSelect, orderBy: byName } },
  });
  return parent?.cities ?? null;
}

async function listDistricts(cityId: string): Promise<RegionRecord[] | null> {
  const parent = await prisma.city.findUnique({
    where: { id: cityId },
    select: { districts: { select: regionSelect, orderBy: byName } },
  });
  return parent?.districts ?? null;
}

async function listSubDistricts(districtId: string): Promise<RegionRecord[] | null> {
  const parent = await prisma.district.findUnique({
    where: { id: districtId },
    select: { subDistricts: { select: regionSelect, orderBy: byName } },
  });
  return parent?.subDistricts ?? null;
}

export interface RegionIds {
  provinceId: string;
  cityId: string;
  districtId: string;
  subDistrictId: string;
}

// What the database knows about four chosen ids: each entry is null when that id does not
// exist, otherwise it carries the id of its parent.
export interface RegionParents {
  province: { id: string } | null;
  city: { provinceId: string } | null;
  district: { cityId: string } | null;
  subDistrict: { districtId: string } | null;
}

type Client = Prisma.TransactionClient | typeof prisma;

async function findParents(ids: RegionIds, client: Client = prisma): Promise<RegionParents> {
  const [province, city, district, subDistrict] = await Promise.all([
    client.province.findUnique({ where: { id: ids.provinceId }, select: { id: true } }),
    client.city.findUnique({ where: { id: ids.cityId }, select: { provinceId: true } }),
    client.district.findUnique({ where: { id: ids.districtId }, select: { cityId: true } }),
    client.subDistrict.findUnique({ where: { id: ids.subDistrictId }, select: { districtId: true } }),
  ]);
  return { province, city, district, subDistrict };
}

export const regionRepository = {
  listProvinces,
  listCities,
  listDistricts,
  listSubDistricts,
  findParents,
};
