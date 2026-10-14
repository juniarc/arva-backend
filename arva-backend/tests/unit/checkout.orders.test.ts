import { describe, expect, it, vi } from 'vitest';
import { damageProtectionFee } from '../../src/lib/damage-protection.js';
import { StockConflictError, ValidationError } from '../../src/lib/errors.js';
import { voucherDiscount, type CheckoutMoney, type VoucherRule } from '../../src/lib/voucher-discount.js';
import type { NewOrderData, OrderTransaction } from '../../src/repositories/order.repository.js';
import { OrderCodeTakenError } from '../../src/repositories/order.repository.js';
import type { DraftRecord } from '../../src/repositories/checkout.repository.js';
import { toDraftResponse } from '../../src/services/checkout.mapper.js';
import { newOrderCode, orderService } from '../../src/services/order.service.js';
import { buildDraft, fullAddress } from '../helpers/draftRecord.js';

const NOW = new Date('2026-10-14T10:00:00Z');

const rule = (overrides: Partial<VoucherRule> = {}): VoucherRule => ({
  type: 'PERCENT',
  value: 10,
  maxDiscount: null,
  minSpend: 0,
  shopId: null,
  startsAt: new Date('2026-10-01T00:00:00Z'),
  endsAt: new Date('2026-12-31T00:00:00Z'),
  usageLimit: null,
  usedCount: 0,
  isActive: true,
  ...overrides,
});

const money = (overrides: Partial<CheckoutMoney> = {}): CheckoutMoney => ({
  productSubtotal: 100000,
  shopSubtotals: new Map([
    [1, 70000],
    [2, 30000],
  ]),
  shippingPrice: 12000,
  shipmentCount: 2,
  ...overrides,
});

describe('damageProtectionFee', () => {
  it('is 1% of the products, rounded, and at least Rp 1.000', () => {
    expect(damageProtectionFee(250000)).toBe(2500);
    expect(damageProtectionFee(123456)).toBe(1235);
    expect(damageProtectionFee(50000)).toBe(1000);
    expect(damageProtectionFee(0)).toBe(1000);
  });
});

describe('voucherDiscount', () => {
  it('takes a percent off, capped by the maximum', () => {
    expect(voucherDiscount(rule({ value: 15 }), money(), NOW)).toBe(15000);
    expect(voucherDiscount(rule({ value: 15, maxDiscount: 10000 }), money(), NOW)).toBe(10000);
  });

  it('takes a fixed amount off, never more than the products', () => {
    expect(voucherDiscount(rule({ type: 'FIXED', value: 20000 }), money(), NOW)).toBe(20000);
    expect(voucherDiscount(rule({ type: 'FIXED', value: 20000, shopId: 2 }), money(), NOW)).toBe(20000);
    expect(voucherDiscount(rule({ type: 'FIXED', value: 50000, shopId: 2 }), money(), NOW)).toBe(30000);
  });

  it("counts only the shop's products for a shop voucher, and its minimum spend", () => {
    expect(voucherDiscount(rule({ shopId: 1 }), money(), NOW)).toBe(7000);
    expect(voucherDiscount(rule({ shopId: 2, minSpend: 50000 }), money(), NOW)).toBeNull();
    expect(voucherDiscount(rule({ shopId: 9 }), money(), NOW)).toBeNull();
  });

  it('covers the shipping for free shipping: all shipments, or the shop\'s one', () => {
    expect(voucherDiscount(rule({ type: 'FREE_SHIPPING', value: 15000 }), money(), NOW)).toBe(15000);
    expect(voucherDiscount(rule({ type: 'FREE_SHIPPING', value: 50000 }), money(), NOW)).toBe(24000);
    expect(voucherDiscount(rule({ type: 'FREE_SHIPPING', value: 50000, shopId: 1 }), money(), NOW)).toBe(12000);
    expect(voucherDiscount(rule({ type: 'FREE_SHIPPING', value: 15000 }), money({ shippingPrice: null }), NOW)).toBe(0);
  });

  it('cannot be used when switched off, outside its dates, used up or below the minimum spend', () => {
    expect(voucherDiscount(rule({ isActive: false }), money(), NOW)).toBeNull();
    expect(voucherDiscount(rule({ startsAt: new Date('2026-11-01T00:00:00Z') }), money(), NOW)).toBeNull();
    expect(voucherDiscount(rule({ endsAt: new Date('2026-10-01T00:00:00Z') }), money(), NOW)).toBeNull();
    expect(voucherDiscount(rule({ usageLimit: 5, usedCount: 5 }), money(), NOW)).toBeNull();
    expect(voucherDiscount(rule({ minSpend: 150000 }), money(), NOW)).toBeNull();
  });
});

const voucherRecord = (overrides: Partial<NonNullable<DraftRecord['voucher']>> = {}): NonNullable<DraftRecord['voucher']> => ({
  id: 4,
  code: 'WELCOME15',
  title: '15% off',
  type: 'PERCENT',
  value: 15,
  maxDiscount: null,
  minSpend: 0,
  shopId: null,
  startsAt: new Date('2026-10-01T00:00:00Z'),
  endsAt: new Date('2026-12-31T00:00:00Z'),
  usageLimit: 10,
  usedCount: 0,
  isActive: true,
  shop: null,
  ...overrides,
});

const shippingOption = { id: 7, name: 'Regular', price: 12000, minDays: 3, maxDays: 5, isActive: true, channelId: 1, channel: { name: 'JNE' } };

function readyDraft(overrides: Partial<DraftRecord> = {}): DraftRecord {
  return buildDraft([{ id: 1, price: 50000, quantity: 2 }], {
    ...fullAddress,
    shippingOption,
    paymentMethod: { id: 3, name: 'QRIS', isEnabled: true },
    ...overrides,
  });
}

describe('the draft with damage protection and a voucher', () => {
  it('charges damage protection only when it is on, and takes the voucher off the total', () => {
    const response = toDraftResponse(readyDraft({ damageProtectionEnabled: true, voucher: voucherRecord() }), NOW);

    expect(response.damageProtection).toEqual({ enabled: true, fee: 1000 });
    expect(response.voucher).toEqual({ id: '4', title: '15% off', code: 'WELCOME15', discountAmount: 15000 });
    expect(response.summary).toMatchObject({ productSubtotal: 100000, shippingSubtotal: 12000, damageProtectionFee: 1000, discount: 15000 });
    expect(response.summary.total).toBe(100000 + 12000 + 1000 - 15000);
  });

  it('drops a chosen voucher that can no longer be used', () => {
    const response = toDraftResponse(readyDraft({ voucher: voucherRecord({ usedCount: 10 }) }), NOW);
    expect(response.voucher).toBeNull();
    expect(response.summary.discount).toBe(0);
  });
});

function fakeTx(record: DraftRecord | null, overrides: Partial<OrderTransaction> = {}) {
  const tx: OrderTransaction = {
    findDraft: vi.fn(async () => record),
    takeStock: vi.fn(async () => true),
    useVoucher: vi.fn(async () => true),
    createOrder: vi.fn(async (data: NewOrderData) => ({ id: 77, code: data.code })),
    addSold: vi.fn(async () => undefined),
    clearCheckout: vi.fn(async () => undefined),
    ...overrides,
  };
  return { tx, repo: { runInTransaction: <T>(work: (t: OrderTransaction) => Promise<T>) => work(tx) } };
}

describe('newOrderCode', () => {
  it('is ORD, the date and 6 easy-to-read characters', () => {
    expect(newOrderCode(NOW)).toMatch(/^ORD-261014-[A-HJ-NP-Z2-9]{6}$/);
  });
});

describe('orderService.placeOrder', () => {
  it('takes the stock, counts the voucher, writes the order with copied amounts, and clears the checkout', async () => {
    const { tx, repo } = fakeTx(readyDraft({ voucher: voucherRecord() }));

    const order = await orderService.placeOrder(5, NOW, repo);

    expect(order.id).toBe('77');
    expect(order.code).toMatch(/^ORD-261014-/);
    expect(tx.takeStock).toHaveBeenCalledWith(10, 2);
    expect(tx.useVoucher).toHaveBeenCalledWith(4, 10);
    const data = vi.mocked(tx.createOrder).mock.calls[0]?.[0];
    expect(data).toMatchObject({
      userId: 5,
      // The payment is simulated: the order is paid when it is placed.
      status: 'PAID',
      paidAt: NOW,
      recipientName: 'Alice',
      cityName: 'Kota Administrasi Jakarta Pusat',
      shippingLabel: 'JNE Regular',
      shippingPrice: 12000,
      shipmentCount: 1,
      paymentMethodName: 'QRIS',
      voucherCode: 'WELCOME15',
      productSubtotal: 100000,
      discount: 15000,
      total: 97000,
    });
    expect(data?.items).toEqual([
      expect.objectContaining({ variantId: 10, productName: 'P1', price: 50000, quantity: 2, lineTotal: 100000 }),
    ]);
    expect(tx.clearCheckout).toHaveBeenCalledWith(5, [100]);
    // The paid order's products count as sold.
    expect(tx.addSold).toHaveBeenCalledWith(1, 2);
  });

  it.each([
    ['address', { addressLabel: null }, 'Add your delivery address first.'],
    ['shipping', { shippingOption: null }, 'Choose a shipping option first.'],
    ['payment method', { paymentMethod: null }, 'Choose a payment method first.'],
  ])('needs the %s first, and changes nothing', async (_name, overrides, message) => {
    const { tx, repo } = fakeTx(readyDraft(overrides as Partial<DraftRecord>));

    await expect(orderService.placeOrder(5, NOW, repo)).rejects.toThrow(message);
    expect(tx.takeStock).not.toHaveBeenCalled();
    expect(tx.createOrder).not.toHaveBeenCalled();
    expect(tx.addSold).not.toHaveBeenCalled();
  });

  it('refuses when the stock ran out (the transaction then keeps nothing)', async () => {
    const { tx, repo } = fakeTx(readyDraft(), { takeStock: vi.fn(async () => false) });

    await expect(orderService.placeOrder(5, NOW, repo)).rejects.toBeInstanceOf(StockConflictError);
    expect(tx.createOrder).not.toHaveBeenCalled();
  });

  it('refuses a voucher that has just run out', async () => {
    const { tx, repo } = fakeTx(readyDraft({ voucher: voucherRecord() }), { useVoucher: vi.fn(async () => false) });

    await expect(orderService.placeOrder(5, NOW, repo)).rejects.toBeInstanceOf(ValidationError);
    expect(tx.createOrder).not.toHaveBeenCalled();
  });

  it('refuses when a product is no longer available', async () => {
    const { repo } = fakeTx(buildDraft([{ id: 1 }, { id: 2, isActive: false }], { ...fullAddress, shippingOption, paymentMethod: { id: 3, name: 'QRIS', isEnabled: true } }));
    await expect(orderService.placeOrder(5, NOW, repo)).rejects.toMatchObject({ code: 'PRODUCT_UNAVAILABLE' });
  });

  it('draws a new code when another order took it at the same moment', async () => {
    const createOrder = vi
      .fn()
      .mockRejectedValueOnce(new OrderCodeTakenError())
      .mockImplementation(async (data: NewOrderData) => ({ id: 78, code: data.code }));
    const { repo } = fakeTx(readyDraft(), { createOrder });

    expect((await orderService.placeOrder(5, NOW, repo)).id).toBe('78');
    expect(createOrder).toHaveBeenCalledTimes(2);
  });
});

describe('orderService.listOrders', () => {
  const record = {
    id: 1,
    code: 'ORD-261014-X22L8W',
    status: 'PAID' as const,
    createdAt: NOW,
    paidAt: NOW,
    addressLabel: 'Home',
    addressStreet: 'Jl. Mawar 1',
    recipientName: 'Alice',
    phone: '081234567890',
    provinceName: 'DKI Jakarta',
    cityName: 'Jakarta Pusat',
    districtName: 'Tanah Abang',
    subDistrictName: 'Gelora',
    shippingLabel: 'JNE Regular',
    shippingPrice: 12000,
    shipmentCount: 1,
    paymentMethodName: 'QRIS',
    voucherCode: null,
    productSubtotal: 100000,
    shippingSubtotal: 12000,
    buyerServiceFee: 0,
    handlingFee: 0,
    damageProtectionFee: 0,
    discount: 0,
    total: 112000,
    items: [
      { id: 9, shopName: 'Farm', productName: 'Banana', variantLabel: '1 kg', unit: 'kg', price: 50000, quantity: 2, lineTotal: 100000, imageUrl: '/images/dummy/x.jpg', product: { slug: 'banana', isActive: true }, shop: { slug: 'farm' } },
      { id: 10, shopName: 'Farm', productName: 'Gone', variantLabel: '1 kg', unit: 'kg', price: 1, quantity: 1, lineTotal: 1, imageUrl: '', product: null, shop: null },
    ],
  };

  it('returns the orders with pages, and no link for a product that is gone', async () => {
    const repo = { findOrders: vi.fn(async () => [record]), countOrders: vi.fn(async () => 11) };

    const result = await orderService.listOrders(5, 2, 10, repo);

    expect(repo.findOrders).toHaveBeenCalledWith(5, 10, 10);
    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 11, totalPages: 2 });
    const [order] = result.orders;
    expect(order).toMatchObject({ id: '1', code: 'ORD-261014-X22L8W', status: 'PAID', paymentMethod: 'QRIS', createdAt: NOW.toISOString() });
    expect(order?.items[0]).toMatchObject({ productSlug: 'banana', shopSlug: 'farm', lineTotal: 100000 });
    expect(order?.items[1]).toMatchObject({ productSlug: null, shopSlug: null, imageUrl: '' });
    expect(JSON.stringify(result)).not.toMatch(/userId/);
  });
});
