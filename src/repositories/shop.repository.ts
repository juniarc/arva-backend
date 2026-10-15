import { Prisma } from '@prisma/client';
import { ShopAlreadyExistsError, ShopNameViolationError, ShopSlugViolationError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { shopViolationFromTarget } from '../lib/unique-violation.js';
import { regionRepository, type RegionIds, type RegionParents } from './region.repository.js';

// ownerId is deliberately not selected here: it must never reach the API.
const shopSelect = {
  slug: true,
  name: true,
  city: true,
  logoUrl: true,
  ratingTenths: true,
  ratingCount: true,
  _count: { select: { products: { where: { isActive: true } } } },
} satisfies Prisma.ShopSelect;

export type ShopRecord = Prisma.ShopGetPayload<{ select: typeof shopSelect }>;

// ownerId is selected only so the service can compare it with the viewer. It is never returned.
// The owner's private details are read by a separate query (see ownerDetailsSelect).
const publicShopSelect = {
  id: true,
  ownerId: true,
  slug: true,
  name: true,
  city: true,
  logoUrl: true,
  description: true,
  openingTime: true,
  closingTime: true,
  ratingTenths: true,
  ratingCount: true,
  _count: { select: { products: { where: { isActive: true } } } },
} satisfies Prisma.ShopSelect;

export type PublicShopRecord = Prisma.ShopGetPayload<{ select: typeof publicShopSelect }>;

// Contact and address data. Only loaded when the viewer is the owner.
const ownerDetailsSelect = {
  email: true,
  phone: true,
  street: true,
  zipCode: true,
  province: { select: { id: true, name: true } },
  cityRegion: { select: { id: true, name: true } },
  district: { select: { id: true, name: true } },
  subDistrict: { select: { id: true, name: true } },
  shippingChannels: {
    orderBy: { shippingChannel: { sortOrder: 'asc' } },
    select: { shippingChannel: { select: { id: true, name: true } } },
  },
} satisfies Prisma.ShopSelect;

export type OwnerDetailsRecord = Prisma.ShopGetPayload<{ select: typeof ownerDetailsSelect }>;

const ownerShopSelect = {
  slug: true,
  name: true,
  logoUrl: true,
  description: true,
  openingTime: true,
  closingTime: true,
  provinceId: true,
  cityId: true,
  districtId: true,
  subDistrictId: true,
  street: true,
  zipCode: true,
  email: true,
  phone: true,
  shippingChannels: { select: { shippingChannelId: true } },
} satisfies Prisma.ShopSelect;

export type OwnerShopRecord = Prisma.ShopGetPayload<{ select: typeof ownerShopSelect }>;

export interface ShopUpdateData extends RegionIds {
  name: string;
  // The name of the chosen city, kept in step with cityId (the product list filters on it).
  city: string;
  email: string;
  phone: string | null;
  street: string;
  openingTime: string;
  closingTime: string;
  // undefined means "keep the current value".
  description?: string;
  zipCode?: string;
}

export interface ShopCreateData extends ShopUpdateData {
  slug: string;
  ownerId: number;
}

// The steps the service takes inside one database transaction.
export interface ShopTransaction {
  findOwnedShop(userId: number): Promise<{ id: number } | null>;
  findRegionParents(ids: RegionIds): Promise<RegionParents>;
  findCityName(cityId: string): Promise<string | null>;
  // The ids that are not shipping channels.
  findMissingChannelIds(channelIds: number[]): Promise<number[]>;
  isNameTakenByOther(name: string, shopId: number): Promise<boolean>;
  isNameTaken(name: string): Promise<boolean>;
  isSlugTaken(slug: string): Promise<boolean>;
  createShop(data: ShopCreateData): Promise<number>;
  updateShop(shopId: number, data: ShopUpdateData): Promise<void>;
  replaceChannels(shopId: number, channelIds: number[]): Promise<void>;
  findOwnerShop(userId: number): Promise<OwnerShopRecord | null>;
}

function findBySlug(slug: string): Promise<ShopRecord | null> {
  return prisma.shop.findUnique({ where: { slug }, select: shopSelect });
}

function findPublicBySlug(slug: string): Promise<PublicShopRecord | null> {
  return prisma.shop.findUnique({ where: { slug }, select: publicShopSelect });
}

function findIdentityBySlug(slug: string): Promise<{ id: number; ownerId: number | null } | null> {
  return prisma.shop.findUnique({ where: { slug }, select: { id: true, ownerId: true } });
}

function findOwnerDetails(shopId: number): Promise<OwnerDetailsRecord | null> {
  return prisma.shop.findUnique({ where: { id: shopId }, select: ownerDetailsSelect });
}

function findByOwner(userId: number): Promise<OwnerShopRecord | null> {
  return prisma.shop.findUnique({ where: { ownerId: userId }, select: ownerShopSelect });
}

// Cities of shops that have at least one product the public list can show
// (active, with a variant). Only the city column is read.
async function findCitiesWithActiveProducts(): Promise<string[]> {
  const shops = await prisma.shop.findMany({
    where: { products: { some: { isActive: true, variants: { some: {} } } } },
    select: { city: true },
    distinct: ['city'],
  });
  return shops.map((shop) => shop.city);
}

function createTransaction(client: Prisma.TransactionClient): ShopTransaction {
  return {
    findOwnedShop: (userId) => client.shop.findUnique({ where: { ownerId: userId }, select: { id: true } }),

    findRegionParents: (ids) => regionRepository.findParents(ids, client),

    async findCityName(cityId) {
      const city = await client.city.findUnique({ where: { id: cityId }, select: { name: true } });
      return city?.name ?? null;
    },

    async findMissingChannelIds(channelIds) {
      const found = await client.shippingChannel.findMany({
        where: { id: { in: channelIds } },
        select: { id: true },
      });
      const foundIds = new Set(found.map((channel) => channel.id));
      return channelIds.filter((id) => !foundIds.has(id));
    },

    async isNameTakenByOther(name, shopId) {
      const other = await client.shop.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, id: { not: shopId } },
        select: { id: true },
      });
      return other !== null;
    },

    async isNameTaken(name) {
      const other = await client.shop.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { id: true },
      });
      return other !== null;
    },

    async isSlugTaken(slug) {
      const other = await client.shop.findUnique({ where: { slug }, select: { id: true } });
      return other !== null;
    },

    async createShop(data) {
      const created = await client.shop.create({ data, select: { id: true } });
      return created.id;
    },

    // The slug is never written, so links to the shop keep working after a rename.
    async updateShop(shopId, data) {
      await client.shop.update({ where: { id: shopId }, data, select: { id: true } });
    },

    async replaceChannels(shopId, channelIds) {
      await client.shopShippingChannel.deleteMany({ where: { shopId } });
      await client.shopShippingChannel.createMany({
        data: channelIds.map((shippingChannelId) => ({ shopId, shippingChannelId })),
      });
    },

    findOwnerShop: (userId) => client.shop.findUnique({ where: { ownerId: userId }, select: ownerShopSelect }),
  };
}

// The service checks first, but two requests can race past the checks. The unique indexes are the
// final guard, and the transaction is rolled back. A violation becomes an error the service understands:
// the name index (lower(name)), the slug, or the owner (one shop per user).
async function runInTransaction<T>(work: (tx: ShopTransaction) => Promise<T>): Promise<T> {
  try {
    return await prisma.$transaction((client) => work(createTransaction(client)));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      switch (shopViolationFromTarget(error.meta?.target)) {
        case 'slug':
          throw new ShopSlugViolationError();
        case 'owner':
          throw new ShopAlreadyExistsError();
        case 'name':
          throw new ShopNameViolationError();
        default:
          break;
      }
    }
    throw error;
  }
}

export const shopRepository = {
  findBySlug,
  findPublicBySlug,
  findIdentityBySlug,
  findOwnerDetails,
  findByOwner,
  findCitiesWithActiveProducts,
  runInTransaction,
};
