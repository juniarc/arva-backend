import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConflictError,
  ShopAlreadyExistsError,
  ShopNameViolationError,
  ShopSlugViolationError,
  ValidationError,
} from '../../src/lib/errors.js';
import type { OwnerShopRecord } from '../../src/repositories/shop.repository.js';

const { fakeShops, fakeTx } = vi.hoisted(() => {
  const fakeTx = {
    findOwnedShop: vi.fn(),
    findRegionParents: vi.fn(),
    findCityName: vi.fn(),
    findMissingChannelIds: vi.fn(),
    isNameTaken: vi.fn(),
    isSlugTaken: vi.fn(),
    createShop: vi.fn(),
    replaceChannels: vi.fn(),
    findOwnerShop: vi.fn(),
  };
  const fakeShops = {
    runInTransaction: vi.fn(async (work: (tx: typeof fakeTx) => Promise<unknown>) => work(fakeTx)),
  };
  return { fakeShops, fakeTx };
});

vi.mock('../../src/repositories/shop.repository.js', () => ({ shopRepository: fakeShops }));
vi.mock('../../src/repositories/shop-product.repository.js', () => ({ shopProductRepository: {} }));

const { shopService } = await import('../../src/services/shop.service.js');

const input = {
  name: 'Fresh Farm!',
  provinceId: '31',
  cityId: '3171',
  districtId: '317107',
  subDistrictId: '3171071001',
  street: 'Jl. Toko 7',
  email: 'owner@shop.example.com',
  phone: null,
  openingTime: '08:00',
  closingTime: '17:00',
  shippingChannelIds: ['1', '2'],
};
const consistent = {
  province: { id: '31' },
  city: { provinceId: '31' },
  district: { cityId: '3171' },
  subDistrict: { districtId: '317107' },
};

function ownerShop(): OwnerShopRecord {
  return {
    slug: 'fresh-farm',
    name: 'Fresh Farm!',
    logoUrl: null,
    description: '',
    openingTime: '08:00',
    closingTime: '17:00',
    provinceId: '31',
    cityId: '3171',
    districtId: '317107',
    subDistrictId: '3171071001',
    street: 'Jl. Toko 7',
    zipCode: null,
    email: 'owner@shop.example.com',
    phone: null,
    shippingChannels: [{ shippingChannelId: 1 }, { shippingChannelId: 2 }],
  };
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('Expected the promise to reject.');
    },
    (error: unknown) => error,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fakeShops.runInTransaction.mockImplementation(async (work) => work(fakeTx));
  fakeTx.findOwnedShop.mockResolvedValue(null);
  fakeTx.findRegionParents.mockResolvedValue(consistent);
  fakeTx.findCityName.mockResolvedValue('Jakarta Selatan');
  fakeTx.findMissingChannelIds.mockResolvedValue([]);
  fakeTx.isNameTaken.mockResolvedValue(false);
  fakeTx.isSlugTaken.mockResolvedValue(false);
  fakeTx.createShop.mockResolvedValue(11);
  fakeTx.findOwnerShop.mockResolvedValue(ownerShop());
});

describe('shopService.createShop', () => {
  it('creates the shop for the verified user, with a slug made from the name', async () => {
    const shop = await shopService.createShop(7, input);

    expect(fakeTx.createShop).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'fresh-farm', ownerId: 7, name: 'Fresh Farm!', city: 'Jakarta Selatan', cityId: '3171' }),
    );
    expect(fakeTx.replaceChannels).toHaveBeenCalledWith(11, [1, 2]);
    expect(shop.slug).toBe('fresh-farm');
    expect(shop.shippingChannelIds).toEqual(['1', '2']);
  });

  it('leaves description and zip code out when they are omitted', async () => {
    await shopService.createShop(7, input);

    const data = fakeTx.createShop.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(data.description).toBeUndefined();
    expect(data.zipCode).toBeUndefined();
  });

  it('adds a number to the slug when it is taken', async () => {
    fakeTx.isSlugTaken.mockImplementation(async (slug: string) => slug === 'fresh-farm' || slug === 'fresh-farm-2');

    await shopService.createShop(7, input);

    expect(fakeTx.createShop).toHaveBeenCalledWith(expect.objectContaining({ slug: 'fresh-farm-3' }));
  });

  it('retries with the next slug when the database reports a slug clash', async () => {
    fakeTx.createShop.mockRejectedValueOnce(new ShopSlugViolationError());

    await shopService.createShop(7, input);

    expect(fakeShops.runInTransaction).toHaveBeenCalledTimes(2);
    expect(fakeTx.createShop).toHaveBeenCalledTimes(2);
  });

  it('gives up after a few slug clashes', async () => {
    fakeTx.createShop.mockRejectedValue(new ShopSlugViolationError());

    const error = await rejection(shopService.createShop(7, input));

    expect(error).toBeInstanceOf(ShopSlugViolationError);
    expect(fakeShops.runInTransaction).toHaveBeenCalledTimes(5);
  });

  it('rejects a user who already owns a shop, and creates nothing', async () => {
    fakeTx.findOwnedShop.mockResolvedValue({ id: 3 });

    const error = await rejection(shopService.createShop(7, input));

    expect(error).toBeInstanceOf(ShopAlreadyExistsError);
    expect(fakeTx.createShop).not.toHaveBeenCalled();
  });

  it('passes the database "one shop per user" error through', async () => {
    fakeTx.createShop.mockRejectedValue(new ShopAlreadyExistsError());

    await expect(shopService.createShop(7, input)).rejects.toBeInstanceOf(ShopAlreadyExistsError);
    expect(fakeShops.runInTransaction).toHaveBeenCalledTimes(1);
  });

  it('returns 409 with field name when the name is taken', async () => {
    fakeTx.isNameTaken.mockResolvedValue(true);

    const error = await rejection(shopService.createShop(7, input));

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).field).toBe('name');
  });

  it('maps a database name violation to the same 409', async () => {
    fakeTx.createShop.mockRejectedValue(new ShopNameViolationError());

    const error = await rejection(shopService.createShop(7, input));

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).field).toBe('name');
  });

  it('rejects a city from another province with errors.cityId, and unknown channels', async () => {
    fakeTx.findRegionParents.mockResolvedValue({ ...consistent, city: { provinceId: '32' } });
    fakeTx.findMissingChannelIds.mockResolvedValue([2]);

    const error = await rejection(shopService.createShop(7, input));

    expect(error).toBeInstanceOf(ValidationError);
    expect(Object.keys((error as ValidationError).errors).sort()).toEqual(['cityId', 'shippingChannelIds']);
    expect(fakeTx.createShop).not.toHaveBeenCalled();
  });
});
