import {
  ConflictError,
  NotFoundError,
  ShopAlreadyExistsError,
  ShopNameViolationError,
  ShopSlugViolationError,
  ValidationError,
} from '../lib/errors.js';
import { toImageUrl } from '../lib/imageUrl.js';
import { buildPagination, type Pagination } from '../lib/pagination.js';
import { toShopRating, type ShopRatingResponse } from '../lib/rating.js';
import { checkShopRegions } from '../lib/shop-address.js';
import { toOperatingHours } from '../lib/shop-hours.js';
import { slugCandidate, slugify } from '../lib/slug.js';
import { shopProductRepository, type ShopProductRecord } from '../repositories/shop-product.repository.js';
import {
  shopRepository,
  type OwnerDetailsRecord,
  type OwnerShopRecord,
  type PublicShopRecord,
  type ShopTransaction,
} from '../repositories/shop.repository.js';
import type { RegionIds } from '../repositories/region.repository.js';
import type { CreateShopInput, ShopProductsQuery, UpdateOwnerShopInput } from '../schemas/shop.schema.js';
import { toProductResponse } from './product.service.js';

const SHOP_NOT_FOUND = 'Shop not found.';

interface RegionRef {
  id: string;
  name: string;
}

export interface OwnerDetailsResponse {
  contact: { email: string | null; phone: string | null };
  address: {
    street: string;
    zipCode: string;
    province: RegionRef;
    city: RegionRef;
    district: RegionRef;
    subDistrict: RegionRef;
  } | null;
  shippingChannels: { id: string; name: string }[];
}

export interface PublicShopResponse {
  slug: string;
  name: string;
  city: string;
  logoUrl: string | null;
  description: string;
  operatingHours: { open: string; close: string };
  rating: ShopRatingResponse;
  productCount: number;
  isOwner: boolean;
  ownerDetails: OwnerDetailsResponse | null;
}

export interface OwnerShopResponse {
  slug: string;
  name: string;
  logoUrl: string | null;
  description: string;
  operatingHours: { open: string; close: string };
  provinceId: string | null;
  cityId: string | null;
  districtId: string | null;
  subDistrictId: string | null;
  street: string | null;
  zipCode: string | null;
  email: string | null;
  phone: string | null;
  shippingChannelIds: string[];
}

export interface ShopProductResponse {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  categoryName: string;
  price: number;
  originalPrice: number | null;
  discountPercent: number | null;
  rating: number;
  soldCount: number;
  city: string;
  shop: { slug: string; name: string };
  manage: {
    isActive: boolean;
    totalStock: number;
    variantLabels: string[];
    ratingCount: number;
  } | null;
}

export interface ShopProductListResponse {
  products: ShopProductResponse[];
  pagination: Pagination;
}

function toRegionRef(region: { id: string; name: string }): RegionRef {
  return { id: region.id, name: region.name };
}

// The owner's private details. The address is null unless the street, the zip code and all four
// regions are set.
export function toOwnerDetails(details: OwnerDetailsRecord): OwnerDetailsResponse {
  const { street, zipCode, province, cityRegion, district, subDistrict } = details;
  const hasAddress = street && zipCode && province && cityRegion && district && subDistrict;

  return {
    contact: { email: details.email, phone: details.phone },
    address: hasAddress
      ? {
          street,
          zipCode,
          province: toRegionRef(province),
          city: toRegionRef(cityRegion),
          district: toRegionRef(district),
          subDistrict: toRegionRef(subDistrict),
        }
      : null,
    shippingChannels: details.shippingChannels.map((link) => ({
      id: String(link.shippingChannel.id),
      name: link.shippingChannel.name,
    })),
  };
}

// ownerDetails is only ever filled when isOwner is true. The caller decides isOwner from the
// verified user id, never from anything the client sends.
export function toPublicShopResponse(
  shop: PublicShopRecord,
  isOwner: boolean,
  details: OwnerDetailsRecord | null,
): PublicShopResponse {
  return {
    slug: shop.slug,
    name: shop.name,
    city: shop.city,
    logoUrl: shop.logoUrl === null ? null : toImageUrl(shop.logoUrl),
    description: shop.description,
    operatingHours: toOperatingHours(shop.openingTime, shop.closingTime),
    rating: toShopRating(shop.ratingTenths, shop.ratingCount),
    // The repository counts active products only.
    productCount: shop._count.products,
    isOwner,
    ownerDetails: isOwner && details ? toOwnerDetails(details) : null,
  };
}

export function toOwnerShopResponse(shop: OwnerShopRecord): OwnerShopResponse {
  return {
    slug: shop.slug,
    name: shop.name,
    logoUrl: shop.logoUrl === null ? null : toImageUrl(shop.logoUrl),
    description: shop.description,
    operatingHours: toOperatingHours(shop.openingTime, shop.closingTime),
    provinceId: shop.provinceId,
    cityId: shop.cityId,
    districtId: shop.districtId,
    subDistrictId: shop.subDistrictId,
    street: shop.street,
    zipCode: shop.zipCode,
    email: shop.email,
    phone: shop.phone,
    shippingChannelIds: shop.shippingChannels
      .map((link) => link.shippingChannelId)
      .sort((a, b) => a - b)
      .map(String),
  };
}

// Price, original price and discount come from the product list mapping (the lowest priced
// variant). The manage block is only built for the owner.
export function toShopProductResponse(product: ShopProductRecord, isOwner: boolean): ShopProductResponse {
  const base = toProductResponse(product);

  return {
    id: base.id,
    slug: base.slug,
    name: base.name,
    imageUrl: base.imageUrl,
    categoryName: base.categoryName,
    price: base.price,
    originalPrice: base.originalPrice,
    discountPercent: base.discountPercent,
    rating: base.rating,
    soldCount: base.soldCount,
    city: base.city,
    shop: { slug: base.shopSlug, name: base.shopName },
    manage: isOwner
      ? {
          isActive: product.isActive,
          totalStock: product.variants.reduce((sum, variant) => sum + variant.stock, 0),
          variantLabels: [...product.variants].sort((a, b) => a.position - b.position).map((variant) => variant.label),
          ratingCount: product.ratingCount,
        }
      : null,
  };
}

// The viewer is the owner only when the verified user id equals the shop's ownerId.
function isShopOwner(ownerId: number | null, viewerId: number | undefined): boolean {
  return viewerId !== undefined && ownerId !== null && ownerId === viewerId;
}

async function getPublicShop(slug: string, viewerId: number | undefined): Promise<PublicShopResponse> {
  const shop = await shopRepository.findPublicBySlug(slug);
  if (!shop) {
    throw new NotFoundError(SHOP_NOT_FOUND);
  }

  const isOwner = isShopOwner(shop.ownerId, viewerId);
  // The private details are not even read for anyone else.
  const details = isOwner ? await shopRepository.findOwnerDetails(shop.id) : null;
  return toPublicShopResponse(shop, isOwner, details);
}

async function getShopProducts(
  slug: string,
  viewerId: number | undefined,
  query: ShopProductsQuery,
): Promise<ShopProductListResponse> {
  const shop = await shopRepository.findIdentityBySlug(slug);
  if (!shop) {
    throw new NotFoundError(SHOP_NOT_FOUND);
  }

  // The owner also sees inactive products. The same filter is used for the items and the total.
  const isOwner = isShopOwner(shop.ownerId, viewerId);
  const skip = (query.page - 1) * query.limit;
  const [records, total] = await Promise.all([
    shopProductRepository.findPage(shop.id, isOwner, query.sort, skip, query.limit),
    shopProductRepository.count(shop.id, isOwner),
  ]);

  return {
    products: records.map((record) => toShopProductResponse(record, isOwner)),
    pagination: buildPagination(query.page, query.limit, total),
  };
}

async function getOwnerShop(userId: number): Promise<OwnerShopResponse> {
  const shop = await shopRepository.findByOwner(userId);
  if (!shop) {
    throw new NotFoundError(SHOP_NOT_FOUND);
  }
  return toOwnerShopResponse(shop);
}

const TOO_MANY_SLUG_TRIES = 50;
const MAX_CREATE_ATTEMPTS = 5;

function toRegionIds(input: CreateShopInput | UpdateOwnerShopInput): RegionIds {
  return {
    provinceId: input.provinceId,
    cityId: input.cityId,
    districtId: input.districtId,
    subDistrictId: input.subDistrictId,
  };
}

// The regions must match each other and the shipping channels must exist. Returns the name of the
// chosen city, which is saved on the shop for the product list city filter.
async function checkRegionsAndChannels(
  tx: ShopTransaction,
  ids: RegionIds,
  channelIds: number[],
): Promise<string> {
  const errors = checkShopRegions(ids, await tx.findRegionParents(ids));
  if ((await tx.findMissingChannelIds(channelIds)).length > 0) {
    errors.shippingChannelIds = 'Unknown shipping channel.';
  }
  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Please fix the highlighted fields.', errors);
  }

  // The regions passed the check, so the city exists.
  const city = await tx.findCityName(ids.cityId);
  if (city === null) {
    throw new ValidationError('Please fix the highlighted fields.', { cityId: 'City not found.' });
  }
  return city;
}

// The first free slug for a name: "farm", then "farm-2", "farm-3" ...
async function findFreeSlug(tx: ShopTransaction, name: string): Promise<string> {
  const base = slugify(name);
  for (let attempt = 1; attempt <= TOO_MANY_SLUG_TRIES; attempt += 1) {
    const slug = slugCandidate(base, attempt);
    if (!(await tx.isSlugTaken(slug))) {
      return slug;
    }
  }
  throw new Error('Could not find a free shop slug');
}

async function createShopOnce(userId: number, input: CreateShopInput): Promise<OwnerShopResponse> {
  const ids = toRegionIds(input);
  const channelIds = [...new Set(input.shippingChannelIds.map(Number))];

  return shopRepository.runInTransaction(async (tx) => {
    // One shop per user (provisional). The unique ownerId is the final guard.
    if (await tx.findOwnedShop(userId)) {
      throw new ShopAlreadyExistsError();
    }
    const city = await checkRegionsAndChannels(tx, ids, channelIds);
    if (await tx.isNameTaken(input.name)) {
      throw new ConflictError('This shop name is already taken.', 'name');
    }

    const shopId = await tx.createShop({
      slug: await findFreeSlug(tx, input.name),
      ownerId: userId,
      name: input.name,
      city,
      description: input.description,
      email: input.email,
      phone: input.phone,
      street: input.street,
      zipCode: input.zipCode,
      openingTime: input.openingTime,
      closingTime: input.closingTime,
      ...ids,
    });
    await tx.replaceChannels(shopId, channelIds);

    const created = await tx.findOwnerShop(userId);
    if (!created) {
      throw new NotFoundError(SHOP_NOT_FOUND);
    }
    return toOwnerShopResponse(created);
  });
}

// The owner is the verified user. There is no way to create a shop for someone else.
async function createShop(userId: number, input: CreateShopInput): Promise<OwnerShopResponse> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await createShopOnce(userId, input);
    } catch (error) {
      // Two shops with the same name got the same slug at the same moment. The next try picks
      // the next free slug.
      if (error instanceof ShopSlugViolationError && attempt < MAX_CREATE_ATTEMPTS) {
        continue;
      }
      if (error instanceof ShopNameViolationError) {
        throw new ConflictError('This shop name is already taken.', 'name');
      }
      throw error;
    }
  }
}

async function updateOwnerShop(userId: number, input: UpdateOwnerShopInput): Promise<OwnerShopResponse> {
  const ids = toRegionIds(input);
  const channelIds = [...new Set(input.shippingChannelIds.map(Number))];

  try {
    return await shopRepository.runInTransaction(async (tx) => {
      // The shop is found through the verified user id. There is no way to name another shop.
      const owned = await tx.findOwnedShop(userId);
      if (!owned) {
        throw new NotFoundError(SHOP_NOT_FOUND);
      }

      const city = await checkRegionsAndChannels(tx, ids, channelIds);
      if (await tx.isNameTakenByOther(input.name, owned.id)) {
        throw new ConflictError('This shop name is already taken.', 'name');
      }

      await tx.updateShop(owned.id, {
        name: input.name,
        city,
        description: input.description,
        email: input.email,
        phone: input.phone,
        street: input.street,
        zipCode: input.zipCode,
        openingTime: input.openingTime,
        closingTime: input.closingTime,
        ...ids,
      });
      await tx.replaceChannels(owned.id, channelIds);

      const updated = await tx.findOwnerShop(userId);
      if (!updated) {
        throw new NotFoundError(SHOP_NOT_FOUND);
      }
      return toOwnerShopResponse(updated);
    });
  } catch (error) {
    // Two parallel updates can both pass the name check. The database index stops the second
    // one, and it gets the same 409 the check would have given.
    if (error instanceof ShopNameViolationError) {
      throw new ConflictError('This shop name is already taken.', 'name');
    }
    throw error;
  }
}

export const shopService = { getPublicShop, getShopProducts, getOwnerShop, createShop, updateOwnerShop };
