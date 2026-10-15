import { NotFoundError, StockConflictError, ValidationError } from '../lib/errors.js';
import { checkRegionParents } from '../lib/region-chain.js';
import type { SelectedCartItem } from '../repositories/cart-draft.repository.js';
import { checkoutOptionsRepository, checkoutRepository } from '../repositories/checkout.repository.js';
import { regionRepository, type RegionIds } from '../repositories/region.repository.js';
import type { AddressInput } from '../schemas/checkout.schema.js';
import { voucherDiscount } from '../lib/voucher-discount.js';
import {
  allowedChannelIds,
  checkoutMoney,
  toDraftResponse,
  toShippingResponse,
  toVoucherRule,
  type DraftResponse,
  type DraftShippingResponse,
} from './checkout.mapper.js';

export type { DraftResponse } from './checkout.mapper.js';
export { checkRegionParents } from '../lib/region-chain.js';

const DRAFT_NOT_FOUND = 'Checkout session not found.';
const ITEMS_GONE = 'Some items are no longer in your cart.';

// Stock is only CHECKED here, never reserved. It is checked again when the order is placed.
function assertItemCanBeBought(item: SelectedCartItem): void {
  const { stock, product } = item.variant;
  if (!product.isActive) {
    throw new StockConflictError('PRODUCT_UNAVAILABLE', 'One of the products is no longer available.');
  }
  if (stock === 0) {
    throw new StockConflictError('OUT_OF_STOCK', `${product.name} is out of stock.`);
  }
  if (item.quantity > stock) {
    throw new StockConflictError('INSUFFICIENT_STOCK', `Only ${stock} left in stock.`);
  }
}

async function createDraft(userId: number, itemIds: string[]): Promise<DraftResponse> {
  const cartItemIds = [...new Set(itemIds.map(Number))];

  return checkoutRepository.runInTransaction(async (tx) => {
    const items = await tx.findSelectedCartItems(userId, cartItemIds);
    // Ids of other users and unknown ids both end up here, so nothing is revealed.
    if (items.length !== cartItemIds.length) {
      throw new ValidationError(ITEMS_GONE, { itemIds: ITEMS_GONE });
    }
    items.forEach(assertItemCanBeBought);

    await tx.replaceDraft(userId, cartItemIds);
    return readDraftOrFail(await tx.findDraft(userId));
  });
}

async function getDraft(userId: number): Promise<DraftResponse> {
  return readDraftOrFail(await checkoutRepository.findDraft(userId));
}

// Replaces the whole address, or saves nothing. Profile data is never touched.
async function setAddress(userId: number, input: AddressInput): Promise<DraftResponse> {
  if (!(await checkoutRepository.draftExists(userId))) {
    throw new NotFoundError(DRAFT_NOT_FOUND);
  }

  const ids: RegionIds = {
    provinceId: input.province.id,
    cityId: input.city.id,
    districtId: input.district.id,
    subDistrictId: input.subDistrict.id,
  };
  const errors = checkRegionParents(ids, await regionRepository.findParents(ids));
  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Please fix the highlighted fields.', errors);
  }

  return checkoutRepository.runInTransaction(async (tx) => {
    const saved = await tx.saveAddress(userId, {
      label: input.label,
      street: input.street,
      recipientName: input.recipientName,
      phone: input.phone,
      ...ids,
    });
    if (!saved) {
      throw new NotFoundError(DRAFT_NOT_FOUND);
    }
    return readDraftOrFail(await tx.findDraft(userId));
  });
}

function readDraftOrFail(record: Parameters<typeof toDraftResponse>[0] | null): DraftResponse {
  if (!record) {
    throw new NotFoundError(DRAFT_NOT_FOUND);
  }
  return toDraftResponse(record);
}

async function requireDraft(userId: number) {
  const record = await checkoutRepository.findDraft(userId);
  if (!record) {
    throw new NotFoundError(DRAFT_NOT_FOUND);
  }
  return record;
}

// The options every shop in the draft can ship with, cheapest first.
async function getShippingOptions(userId: number): Promise<{ options: DraftShippingResponse[] }> {
  const record = await requireDraft(userId);
  const options = await checkoutOptionsRepository.findActiveShippingOptions(allowedChannelIds(record));
  return { options: options.map(toShippingResponse) };
}

async function setShipping(userId: number, optionId: string): Promise<DraftResponse> {
  const record = await requireDraft(userId);
  const options = await checkoutOptionsRepository.findActiveShippingOptions(allowedChannelIds(record));
  if (!options.some((option) => String(option.id) === optionId)) {
    throw new ValidationError('Please fix the highlighted fields.', { optionId: 'This shipping option is not available.' });
  }
  if (!(await checkoutOptionsRepository.saveShippingOption(userId, Number(optionId)))) {
    throw new NotFoundError(DRAFT_NOT_FOUND);
  }
  return getDraft(userId);
}

// Every shop offers the same methods. A method that is switched off is listed but cannot be chosen.
async function getPaymentMethods(userId: number): Promise<{ methods: { id: string; label: string; available: boolean }[] }> {
  await requireDraft(userId);
  const methods = await checkoutOptionsRepository.findPaymentMethods();
  return { methods: methods.map((method) => ({ id: String(method.id), label: method.name, available: method.isEnabled })) };
}

async function setPaymentMethod(userId: number, methodId: string): Promise<DraftResponse> {
  await requireDraft(userId);
  const methods = await checkoutOptionsRepository.findPaymentMethods();
  if (!methods.some((method) => String(method.id) === methodId && method.isEnabled)) {
    throw new ValidationError('Please fix the highlighted fields.', { methodId: 'This payment method is not available.' });
  }
  if (!(await checkoutOptionsRepository.savePaymentMethod(userId, Number(methodId)))) {
    throw new NotFoundError(DRAFT_NOT_FOUND);
  }
  return getDraft(userId);
}

async function setDamageProtection(userId: number, enabled: boolean): Promise<DraftResponse> {
  if (!(await checkoutOptionsRepository.saveDamageProtection(userId, enabled))) {
    throw new NotFoundError(DRAFT_NOT_FOUND);
  }
  return getDraft(userId);
}

export interface VoucherOption {
  id: string;
  title: string;
  description: string;
  code: string;
  // What it takes off this checkout now.
  discountAmount: number;
}

const rupiah = (amount: number) => `Rp${amount.toLocaleString('id-ID')}`;

function describeVoucher(voucher: { minSpend: number; endsAt: Date; shop: { name: string } | null }): string {
  const parts = [];
  if (voucher.shop) parts.push(`For ${voucher.shop.name} products`);
  if (voucher.minSpend > 0) parts.push(`Min. spend ${rupiah(voucher.minSpend)}`);
  parts.push(`Valid until ${voucher.endsAt.toISOString().slice(0, 10)}`);
  return parts.join(' · ');
}

// The vouchers that can be used on this checkout now, the biggest discount first.
async function getVouchers(userId: number, now: Date = new Date()): Promise<{ vouchers: VoucherOption[] }> {
  const record = await requireDraft(userId);
  const money = checkoutMoney(record);
  const candidates = await checkoutOptionsRepository.findVoucherCandidates([...money.shopSubtotals.keys()]);
  const vouchers = candidates.flatMap((voucher) => {
    const discountAmount = voucherDiscount(toVoucherRule(voucher), money, now);
    return discountAmount === null
      ? []
      : [{ id: String(voucher.id), title: voucher.title, description: describeVoucher(voucher), code: voucher.code, discountAmount }];
  });
  return { vouchers: vouchers.sort((a, b) => b.discountAmount - a.discountAmount || Number(a.id) - Number(b.id)) };
}

// null removes the voucher. A voucher must be one of those getVouchers lists.
async function setVoucher(userId: number, voucherId: string | null): Promise<DraftResponse> {
  if (voucherId !== null) {
    const { vouchers } = await getVouchers(userId);
    if (!vouchers.some((voucher) => voucher.id === voucherId)) {
      throw new ValidationError('Please fix the highlighted fields.', { voucherId: 'This voucher cannot be used on this order.' });
    }
  }
  if (!(await checkoutOptionsRepository.saveVoucher(userId, voucherId === null ? null : Number(voucherId)))) {
    throw new NotFoundError(DRAFT_NOT_FOUND);
  }
  return getDraft(userId);
}

export const checkoutService = {
  setDamageProtection,
  getVouchers,
  setVoucher,
  createDraft,
  getDraft,
  setAddress,
  getShippingOptions,
  setShipping,
  getPaymentMethods,
  setPaymentMethod,
};
