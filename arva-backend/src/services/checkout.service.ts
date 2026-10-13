import { NotFoundError, StockConflictError, ValidationError } from '../lib/errors.js';
import { checkRegionParents } from '../lib/region-chain.js';
import type { SelectedCartItem } from '../repositories/cart-draft.repository.js';
import { checkoutRepository } from '../repositories/checkout.repository.js';
import { regionRepository, type RegionIds } from '../repositories/region.repository.js';
import type { AddressInput } from '../schemas/checkout.schema.js';
import { toDraftResponse, type DraftResponse } from './checkout.mapper.js';

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
    provinceId: Number(input.province.id),
    cityId: Number(input.city.id),
    districtId: Number(input.district.id),
    subDistrictId: Number(input.subDistrict.id),
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

export const checkoutService = { createDraft, getDraft, setAddress };
