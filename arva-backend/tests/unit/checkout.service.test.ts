import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError, StockConflictError, ValidationError } from '../../src/lib/errors.js';
import type { SelectedCartItem } from '../../src/repositories/cart-draft.repository.js';
import { buildDraft } from '../helpers/draftRecord.js';

const { fakeTx, fakeCheckout, fakeRegions } = vi.hoisted(() => {
  const fakeTx = {
    findSelectedCartItems: vi.fn(),
    replaceDraft: vi.fn(),
    saveAddress: vi.fn(),
    findDraft: vi.fn(),
  };
  const fakeCheckout = {
    runInTransaction: vi.fn(async (work: (tx: typeof fakeTx) => Promise<unknown>) => work(fakeTx)),
    findDraft: vi.fn(),
    draftExists: vi.fn(),
  };
  const fakeRegions = { findParents: vi.fn() };
  return { fakeTx, fakeCheckout, fakeRegions };
});

vi.mock('../../src/repositories/checkout.repository.js', () => ({ checkoutRepository: fakeCheckout }));
vi.mock('../../src/repositories/region.repository.js', () => ({ regionRepository: fakeRegions }));

const { checkoutService } = await import('../../src/services/checkout.service.js');

const USER = 1;

function cartItem(id: number, overrides: { quantity?: number; stock?: number; isActive?: boolean } = {}): SelectedCartItem {
  return {
    id,
    quantity: overrides.quantity ?? 1,
    variant: {
      stock: overrides.stock ?? 5,
      product: { name: `Product ${id}`, isActive: overrides.isActive ?? true },
    },
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
  fakeCheckout.runInTransaction.mockImplementation(async (work) => work(fakeTx));
  fakeTx.findDraft.mockResolvedValue(buildDraft([{ id: 1 }]));
});

describe('checkoutService.createDraft', () => {
  it('creates the draft and returns it', async () => {
    fakeTx.findSelectedCartItems.mockResolvedValue([cartItem(1), cartItem(2)]);

    const draft = await checkoutService.createDraft(USER, ['1', '2']);

    expect(fakeTx.replaceDraft).toHaveBeenCalledWith(USER, [1, 2]);
    expect(draft.address).toBeNull();
  });

  it('removes duplicate ids before processing', async () => {
    fakeTx.findSelectedCartItems.mockResolvedValue([cartItem(1)]);

    await checkoutService.createDraft(USER, ['1', '1', '1']);

    expect(fakeTx.findSelectedCartItems).toHaveBeenCalledWith(USER, [1]);
    expect(fakeTx.replaceDraft).toHaveBeenCalledWith(USER, [1]);
  });

  it('rejects ids that are not in the user\'s cart without saying why', async () => {
    fakeTx.findSelectedCartItems.mockResolvedValue([cartItem(1)]);

    const error = await rejection(checkoutService.createDraft(USER, ['1', '2']));

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).message).toBe('Some items are no longer in your cart.');
    expect((error as ValidationError).errors).toHaveProperty('itemIds');
    expect(fakeTx.replaceDraft).not.toHaveBeenCalled();
  });

  it('rejects an inactive product with PRODUCT_UNAVAILABLE', async () => {
    fakeTx.findSelectedCartItems.mockResolvedValue([cartItem(1, { isActive: false })]);

    const error = await rejection(checkoutService.createDraft(USER, ['1']));

    expect(error).toBeInstanceOf(StockConflictError);
    expect((error as StockConflictError).code).toBe('PRODUCT_UNAVAILABLE');
    expect((error as StockConflictError).message).toBe('One of the products is no longer available.');
  });

  it('rejects zero stock with OUT_OF_STOCK and the product name', async () => {
    fakeTx.findSelectedCartItems.mockResolvedValue([cartItem(1, { stock: 0 })]);

    const error = await rejection(checkoutService.createDraft(USER, ['1']));

    expect((error as StockConflictError).code).toBe('OUT_OF_STOCK');
    expect((error as StockConflictError).message).toBe('Product 1 is out of stock.');
  });

  it('rejects a quantity above the stock with INSUFFICIENT_STOCK', async () => {
    fakeTx.findSelectedCartItems.mockResolvedValue([cartItem(1, { quantity: 6, stock: 5 })]);

    const error = await rejection(checkoutService.createDraft(USER, ['1']));

    expect((error as StockConflictError).code).toBe('INSUFFICIENT_STOCK');
    expect((error as StockConflictError).message).toBe('Only 5 left in stock.');
    expect(fakeTx.replaceDraft).not.toHaveBeenCalled();
  });

  it('accepts a quantity equal to the stock', async () => {
    fakeTx.findSelectedCartItems.mockResolvedValue([cartItem(1, { quantity: 5, stock: 5 })]);

    await expect(checkoutService.createDraft(USER, ['1'])).resolves.toBeDefined();
  });
});

describe('checkoutService.getDraft', () => {
  it('throws not found when the user has no draft', async () => {
    fakeCheckout.findDraft.mockResolvedValue(null);

    const error = await rejection(checkoutService.getDraft(USER));

    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as NotFoundError).message).toBe('Checkout session not found.');
  });
});

describe('checkoutService.setAddress', () => {
  const input = {
    label: 'Home',
    province: { id: '31' },
    city: { id: '3171' },
    district: { id: '317107' },
    subDistrict: { id: '3171071001' },
    street: 'Jl. Mawar 1',
    recipientName: 'Alice',
    phone: '081234567890',
  };
  const consistent = {
    province: { id: '31' },
    city: { provinceId: '31' },
    district: { cityId: '3171' },
    subDistrict: { districtId: '317107' },
  };

  it('throws not found when there is no draft', async () => {
    fakeCheckout.draftExists.mockResolvedValue(false);

    await expect(checkoutService.setAddress(USER, input)).rejects.toBeInstanceOf(NotFoundError);
    expect(fakeRegions.findParents).not.toHaveBeenCalled();
  });

  it('saves nothing when a region does not match its parent', async () => {
    fakeCheckout.draftExists.mockResolvedValue(true);
    fakeRegions.findParents.mockResolvedValue({ ...consistent, city: { provinceId: '32' } });

    const error = await rejection(checkoutService.setAddress(USER, input));

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toEqual({ city: 'This city is not in the selected province.' });
    expect(fakeTx.saveAddress).not.toHaveBeenCalled();
  });

  it('saves the whole address in one call and returns the draft', async () => {
    fakeCheckout.draftExists.mockResolvedValue(true);
    fakeRegions.findParents.mockResolvedValue(consistent);
    fakeTx.saveAddress.mockResolvedValue(true);

    await checkoutService.setAddress(USER, input);

    expect(fakeTx.saveAddress).toHaveBeenCalledTimes(1);
    expect(fakeTx.saveAddress).toHaveBeenCalledWith(USER, {
      label: 'Home',
      street: 'Jl. Mawar 1',
      recipientName: 'Alice',
      phone: '081234567890',
      provinceId: '31',
      cityId: '3171',
      districtId: '317107',
      subDistrictId: '3171071001',
    });
  });
});
