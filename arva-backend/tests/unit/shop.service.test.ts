import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, NotFoundError, ShopNameViolationError, ValidationError } from '../../src/lib/errors.js';
import type {
  OwnerDetailsRecord,
  OwnerShopRecord,
  PublicShopRecord,
} from '../../src/repositories/shop.repository.js';

const { fakeShops, fakeTx } = vi.hoisted(() => {
  const fakeTx = {
    findOwnedShop: vi.fn(),
    findRegionParents: vi.fn(),
    findCityName: vi.fn(),
    findMissingChannelIds: vi.fn(),
    isNameTakenByOther: vi.fn(),
    updateShop: vi.fn(),
    replaceChannels: vi.fn(),
    findOwnerShop: vi.fn(),
  };
  const fakeShops = {
    findPublicBySlug: vi.fn(),
    findOwnerDetails: vi.fn(),
    findByOwner: vi.fn(),
    runInTransaction: vi.fn(async (work: (tx: typeof fakeTx) => Promise<unknown>) => work(fakeTx)),
  };
  return { fakeShops, fakeTx };
});

vi.mock('../../src/repositories/shop.repository.js', () => ({ shopRepository: fakeShops }));
vi.mock('../../src/repositories/shop-product.repository.js', () => ({ shopProductRepository: {} }));

const { shopService, toOwnerDetails } = await import('../../src/services/shop.service.js');

function publicShop(overrides: Partial<PublicShopRecord> = {}): PublicShopRecord {
  return {
    id: 3,
    ownerId: 9,
    slug: 'my-shop',
    name: 'My Shop',
    city: 'Jakarta Selatan',
    logoUrl: null,
    description: 'Hello.',
    openingTime: '08:00',
    closingTime: '17:00',
    ratingTenths: 44,
    ratingCount: 10,
    _count: { products: 4 },
    ...overrides,
  };
}

function details(overrides: Partial<OwnerDetailsRecord> = {}): OwnerDetailsRecord {
  return {
    email: 'owner@shop.example.com',
    phone: '+6281200001111',
    street: 'Jl. Toko 7',
    zipCode: '12110',
    province: { id: '31', name: 'DKI Jakarta' },
    cityRegion: { id: '3171', name: 'Kota Administrasi Jakarta Pusat' },
    district: { id: '317107', name: 'Tanah Abang' },
    subDistrict: { id: '3171071001', name: 'Gelora' },
    shippingChannels: [{ shippingChannel: { id: 2, name: 'JNE' } }],
    ...overrides,
  };
}

function ownerShop(overrides: Partial<OwnerShopRecord> = {}): OwnerShopRecord {
  return {
    slug: 'my-shop',
    name: 'My Shop',
    logoUrl: null,
    description: '',
    openingTime: '08:00',
    closingTime: '17:00',
    provinceId: '31',
    cityId: '3171',
    districtId: '317107',
    subDistrictId: '3171071001',
    street: 'Jl. Toko 7',
    zipCode: '12110',
    email: 'owner@shop.example.com',
    phone: null,
    shippingChannels: [{ shippingChannelId: 2 }],
    ...overrides,
  };
}

const update = {
  name: 'Brand New Name',
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
  fakeShops.findPublicBySlug.mockResolvedValue(publicShop());
  fakeShops.findOwnerDetails.mockResolvedValue(details());
  fakeTx.findOwnedShop.mockResolvedValue({ id: 3 });
  fakeTx.findRegionParents.mockResolvedValue(consistent);
  fakeTx.findCityName.mockResolvedValue('Jakarta Pusat');
  fakeTx.findMissingChannelIds.mockResolvedValue([]);
  fakeTx.isNameTakenByOther.mockResolvedValue(false);
  fakeTx.findOwnerShop.mockResolvedValue(ownerShop({ name: 'Brand New Name' }));
});

describe('shopService.getPublicShop: ownerDetails', () => {
  it('has isOwner false and ownerDetails null for a guest, and never reads the details', async () => {
    const shop = await shopService.getPublicShop('my-shop', undefined);

    expect(shop.isOwner).toBe(false);
    expect(shop.ownerDetails).toBeNull();
    expect(fakeShops.findOwnerDetails).not.toHaveBeenCalled();
  });

  it('has ownerDetails null even when the viewer owns a different shop', async () => {
    // The viewer is user 5, who owns some other shop. This shop belongs to user 9.
    const shop = await shopService.getPublicShop('my-shop', 5);

    expect(shop.isOwner).toBe(false);
    expect(shop.ownerDetails).toBeNull();
    expect(JSON.stringify(shop)).not.toContain('owner@shop.example.com');
  });

  it('has ownerDetails for the owner', async () => {
    const shop = await shopService.getPublicShop('my-shop', 9);

    expect(shop.isOwner).toBe(true);
    expect(shop.ownerDetails).toEqual({
      contact: { email: 'owner@shop.example.com', phone: '+6281200001111' },
      address: {
        street: 'Jl. Toko 7',
        zipCode: '12110',
        province: { id: '31', name: 'DKI Jakarta' },
        city: { id: '3171', name: 'Kota Administrasi Jakarta Pusat' },
        district: { id: '317107', name: 'Tanah Abang' },
        subDistrict: { id: '3171071001', name: 'Gelora' },
      },
      shippingChannels: [{ id: '2', name: 'JNE' }],
    });
  });

  it('is never the owner for a shop without an owner', async () => {
    fakeShops.findPublicBySlug.mockResolvedValue(publicShop({ ownerId: null }));

    const shop = await shopService.getPublicShop('my-shop', 9);

    expect(shop.isOwner).toBe(false);
  });

  it('does not return ownerId or internal ids', async () => {
    const text = JSON.stringify(await shopService.getPublicShop('my-shop', 9));

    expect(text).not.toMatch(/ownerId|"id":"3"/);
  });

  it('throws not found for an unknown shop', async () => {
    fakeShops.findPublicBySlug.mockResolvedValue(null);

    await expect(shopService.getPublicShop('nope', undefined)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('shopService.getPublicShop: operating hours', () => {
  it('returns the stored hours', async () => {
    const shop = await shopService.getPublicShop('my-shop', undefined);

    expect(shop.operatingHours).toEqual({ open: '08:00', close: '17:00' });
  });

  it('returns 00:00 and 00:00 when the stored times are empty', async () => {
    fakeShops.findPublicBySlug.mockResolvedValue(publicShop({ openingTime: null, closingTime: null }));

    const shop = await shopService.getPublicShop('my-shop', undefined);

    expect(shop.operatingHours).toEqual({ open: '00:00', close: '00:00' });
  });
});

describe('toOwnerDetails: address', () => {
  it.each([
    ['street', { street: null }],
    ['zipCode', { zipCode: null }],
    ['province', { province: null }],
    ['city', { cityRegion: null }],
    ['district', { district: null }],
    ['subDistrict', { subDistrict: null }],
  ] as const)('is null when the %s is missing', (_name, missing) => {
    expect(toOwnerDetails(details(missing)).address).toBeNull();
  });
});

describe('shopService.updateOwnerShop', () => {
  it('keeps the slug when the name changes', async () => {
    const shop = await shopService.updateOwnerShop(7, update);

    const data = fakeTx.updateShop.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(data).not.toHaveProperty('slug');
    expect(data.name).toBe('Brand New Name');
    expect(shop.slug).toBe('my-shop');
  });

  it('sets the city String from the chosen city in the same transaction', async () => {
    await shopService.updateOwnerShop(7, update);

    expect(fakeTx.findCityName).toHaveBeenCalledWith('3171');
    expect(fakeTx.updateShop).toHaveBeenCalledWith(3, expect.objectContaining({ city: 'Jakarta Pusat', cityId: '3171' }));
  });

  it('replaces the channels with the submitted list, without duplicates', async () => {
    await shopService.updateOwnerShop(7, { ...update, shippingChannelIds: ['1', '2'] });

    expect(fakeTx.replaceChannels).toHaveBeenCalledWith(3, [1, 2]);
  });

  it('leaves description and zip code out of the update when they are omitted', async () => {
    await shopService.updateOwnerShop(7, update);

    const data = fakeTx.updateShop.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(data.zipCode).toBeUndefined();
    expect(data.description).toBeUndefined();
  });

  it('throws not found when the user owns no shop', async () => {
    fakeTx.findOwnedShop.mockResolvedValue(null);

    await expect(shopService.updateOwnerShop(7, update)).rejects.toBeInstanceOf(NotFoundError);
    expect(fakeTx.updateShop).not.toHaveBeenCalled();
  });

  it('rejects a city from another province with errors.cityId', async () => {
    fakeTx.findRegionParents.mockResolvedValue({ ...consistent, city: { provinceId: '32' } });

    const error = await rejection(shopService.updateOwnerShop(7, update));

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toEqual({ cityId: 'This city is not in the selected province.' });
    expect(fakeTx.updateShop).not.toHaveBeenCalled();
  });

  it('rejects unknown shipping channels with errors.shippingChannelIds', async () => {
    fakeTx.findMissingChannelIds.mockResolvedValue([2]);

    const error = await rejection(shopService.updateOwnerShop(7, update));

    expect((error as ValidationError).errors).toHaveProperty('shippingChannelIds');
  });

  it('returns 409 with field name when another shop has the name', async () => {
    fakeTx.isNameTakenByOther.mockResolvedValue(true);

    const error = await rejection(shopService.updateOwnerShop(7, update));

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).field).toBe('name');
    expect((error as ConflictError).message).toBe('This shop name is already taken.');
  });

  it('maps a database unique violation on the name to the same 409', async () => {
    fakeTx.updateShop.mockRejectedValue(new ShopNameViolationError());

    const error = await rejection(shopService.updateOwnerShop(7, update));

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).field).toBe('name');
  });
});

describe('shopService.getOwnerShop', () => {
  it('maps flat region ids as strings, sorted channel ids and the hours object', async () => {
    fakeShops.findByOwner.mockResolvedValue(
      ownerShop({ shippingChannels: [{ shippingChannelId: 10 }, { shippingChannelId: 2 }] }),
    );

    const shop = await shopService.getOwnerShop(7);

    expect(shop).toMatchObject({
      provinceId: '31',
      cityId: '3171',
      districtId: '317107',
      subDistrictId: '3171071001',
      operatingHours: { open: '08:00', close: '17:00' },
      shippingChannelIds: ['2', '10'],
    });
  });

  it('returns null region ids when the address is not saved', async () => {
    fakeShops.findByOwner.mockResolvedValue(
      ownerShop({ provinceId: null, cityId: null, districtId: null, subDistrictId: null, street: null, zipCode: null }),
    );

    const shop = await shopService.getOwnerShop(7);

    expect(shop.provinceId).toBeNull();
    expect(shop.street).toBeNull();
  });

  it('throws not found when the user owns no shop', async () => {
    fakeShops.findByOwner.mockResolvedValue(null);

    await expect(shopService.getOwnerShop(7)).rejects.toBeInstanceOf(NotFoundError);
  });
});
