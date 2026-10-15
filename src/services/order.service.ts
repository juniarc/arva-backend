import { randomInt } from 'node:crypto';
import { NotFoundError, StockConflictError, ValidationError } from '../lib/errors.js';
import { toImageUrl } from '../lib/imageUrl.js';
import { OrderCodeTakenError, orderRepository, type OrderHistoryRecord, type OrderTransaction } from '../repositories/order.repository.js';
import { shipmentCount, toDraftResponse } from './checkout.mapper.js';

const DRAFT_NOT_FOUND = 'Checkout session not found.';
const MAX_CODE_ATTEMPTS = 3;
// No 0/O or 1/I, so a code read out loud or typed back is not mistaken.
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// "ORD-261014-7KQ2MZ": the date (YYMMDD) and 6 random characters.
export function newOrderCode(now: Date = new Date()): string {
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  const random = Array.from({ length: 6 }, () => CODE_LETTERS[randomInt(CODE_LETTERS.length)]).join('');
  return `ORD-${date}-${random}`;
}

const missing = (field: string, message: string) => new ValidationError(message, { [field]: message });

// Everything happens in one transaction: the draft is read again, the amounts are worked out
// again, the stock is taken, the voucher is counted, the order is written and the checkout is
// cleared. If any step fails, nothing is kept.
async function placeOnce(tx: OrderTransaction, userId: number, now: Date) {
  const record = await tx.findDraft(userId);
  if (!record) {
    throw new NotFoundError(DRAFT_NOT_FOUND);
  }
  const draft = toDraftResponse(record, now);
  if (draft.unavailableItemCount > 0) {
    throw new StockConflictError('PRODUCT_UNAVAILABLE', 'One of the products is no longer available. Go back to your cart to remove it.');
  }
  if (draft.items.length === 0) {
    throw missing('items', 'There is nothing to order.');
  }
  if (!draft.address) {
    throw missing('address', 'Add your delivery address first.');
  }
  if (!draft.shipping) {
    throw missing('shipping', 'Choose a shipping option first.');
  }
  if (!draft.paymentMethod) {
    throw missing('paymentMethod', 'Choose a payment method first.');
  }

  for (const item of record.items) {
    const { variant, quantity } = item.cartItem;
    if (!(await tx.takeStock(variant.id, quantity))) {
      throw new StockConflictError('INSUFFICIENT_STOCK', `Only ${variant.stock} left of ${variant.product.name}.`);
    }
  }

  if (draft.voucher && record.voucher && !(await tx.useVoucher(record.voucher.id, record.voucher.usageLimit))) {
    throw missing('voucherId', 'This voucher has just run out. Remove it to continue.');
  }

  const { address, shipping, paymentMethod, summary } = draft;
  // No payment provider is connected: the payment is simulated and succeeds at once.
  const created = await tx.createOrder({
    code: newOrderCode(now),
    userId,
    status: 'PAID',
    paidAt: now,
    addressLabel: address.label,
    addressStreet: address.street,
    recipientName: address.recipientName,
    phone: address.phone,
    provinceName: address.province.name,
    cityName: address.city.name,
    districtName: address.district.name,
    subDistrictName: address.subDistrict.name,
    shippingLabel: shipping.label,
    shippingPrice: shipping.price,
    shipmentCount: shipmentCount(record),
    paymentMethodName: paymentMethod.label,
    voucherCode: draft.voucher?.code ?? null,
    productSubtotal: summary.productSubtotal,
    shippingSubtotal: summary.shippingSubtotal,
    buyerServiceFee: summary.buyerServiceFee,
    handlingFee: summary.handlingFee,
    damageProtectionFee: summary.damageProtectionFee,
    discount: summary.discount,
    total: summary.total,
    items: record.items.map(({ cartItem: { variant, quantity } }) => ({
      productId: variant.product.id,
      variantId: variant.id,
      shopId: variant.product.shop.id,
      shopName: variant.product.shop.name,
      productName: variant.product.name,
      variantLabel: variant.label,
      unit: variant.unit,
      price: variant.price,
      quantity,
      lineTotal: variant.price * quantity,
      imageUrl: variant.product.imageUrl,
    })),
  });

  // The order is paid, so its products count as sold.
  for (const { cartItem } of record.items) {
    await tx.addSold(cartItem.variant.product.id, cartItem.quantity);
  }

  await tx.clearCheckout(
    userId,
    record.items.map((item) => item.cartItem.id),
  );
  return { id: String(created.id), code: created.code };
}

// POST /checkout/orders. No payment provider is connected yet, so the order waits for payment.
async function placeOrder(
  userId: number,
  now: Date = new Date(),
  repo: Pick<typeof orderRepository, 'runInTransaction'> = orderRepository,
): Promise<{ id: string; code: string }> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await repo.runInTransaction((tx) => placeOnce(tx, userId, now));
    } catch (error) {
      // Two orders drew the same code: try again with a new one.
      if (error instanceof OrderCodeTakenError && attempt < MAX_CODE_ATTEMPTS) {
        continue;
      }
      throw error;
    }
  }
}

export interface OrderHistoryItem {
  id: string;
  code: string;
  status: 'AWAITING_PAYMENT' | 'PAID' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  paidAt: string | null;
  address: {
    label: string;
    street: string;
    recipientName: string;
    phone: string;
    subDistrict: string;
    district: string;
    city: string;
    province: string;
  };
  shipping: { label: string; price: number; shipmentCount: number };
  paymentMethod: string;
  voucherCode: string | null;
  summary: {
    productSubtotal: number;
    shippingSubtotal: number;
    buyerServiceFee: number;
    handlingFee: number;
    damageProtectionFee: number;
    discount: number;
    total: number;
  };
  items: {
    id: string;
    // Null when the product was deleted or is no longer on sale: the line then has no link.
    productSlug: string | null;
    productName: string;
    variantLabel: string;
    unit: string;
    price: number;
    quantity: number;
    lineTotal: number;
    imageUrl: string;
    shopName: string;
    shopSlug: string | null;
  }[];
}

export function toOrderHistoryItem(order: OrderHistoryRecord): OrderHistoryItem {
  return {
    id: String(order.id),
    code: order.code,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    address: {
      label: order.addressLabel,
      street: order.addressStreet,
      recipientName: order.recipientName,
      phone: order.phone,
      subDistrict: order.subDistrictName,
      district: order.districtName,
      city: order.cityName,
      province: order.provinceName,
    },
    shipping: { label: order.shippingLabel, price: order.shippingPrice, shipmentCount: order.shipmentCount },
    paymentMethod: order.paymentMethodName,
    voucherCode: order.voucherCode,
    summary: {
      productSubtotal: order.productSubtotal,
      shippingSubtotal: order.shippingSubtotal,
      buyerServiceFee: order.buyerServiceFee,
      handlingFee: order.handlingFee,
      damageProtectionFee: order.damageProtectionFee,
      discount: order.discount,
      total: order.total,
    },
    items: order.items.map((item) => ({
      id: String(item.id),
      productSlug: item.product?.isActive ? item.product.slug : null,
      productName: item.productName,
      variantLabel: item.variantLabel,
      unit: item.unit,
      price: item.price,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
      imageUrl: item.imageUrl ? toImageUrl(item.imageUrl) : '',
      shopName: item.shopName,
      shopSlug: item.shop?.slug ?? null,
    })),
  };
}

// GET /orders: the buyer's orders, newest first.
async function listOrders(
  userId: number,
  page: number,
  limit: number,
  repo: Pick<typeof orderRepository, 'findOrders' | 'countOrders'> = orderRepository,
) {
  const [orders, total] = await Promise.all([repo.findOrders(userId, (page - 1) * limit, limit), repo.countOrders(userId)]);
  return {
    orders: orders.map(toOrderHistoryItem),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export const orderService = { placeOrder, listOrders };
