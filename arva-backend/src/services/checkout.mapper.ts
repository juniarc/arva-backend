import { compareCartLines } from '../lib/cart-order.js';
import { calculateCheckoutTotal } from '../lib/checkout-total.js';
import { toImageUrl } from '../lib/imageUrl.js';
import { damageProtectionFee } from '../lib/damage-protection.js';
import { calculateLineTotal } from '../lib/money.js';
import { voucherDiscount, type CheckoutMoney, type VoucherRule } from '../lib/voucher-discount.js';
import type { DraftRecord } from '../repositories/checkout.repository.js';

export interface DraftItemResponse {
  id: string;
  quantity: number;
  product: {
    id: string;
    slug: string;
    name: string;
    imageUrl: string;
    shop: { slug: string; name: string };
  };
  variant: { id: string; label: string; unit: string; price: number; stock: number };
}

interface RegionRef {
  id: string;
  name: string;
}

export interface DraftAddressResponse {
  label: string;
  street: string;
  recipientName: string;
  phone: string;
  province: RegionRef;
  city: RegionRef;
  district: RegionRef;
  subDistrict: RegionRef;
}

export interface DraftResponse {
  items: DraftItemResponse[];
  unavailableItemCount: number;
  address: DraftAddressResponse | null;
  damageProtection: { enabled: boolean; fee: number };
  shipping: DraftShippingResponse | null;
  voucher: { id: string; title: string; code: string; discountAmount: number } | null;
  paymentMethod: { id: string; label: string } | null;
  summary: {
    productSubtotal: number;
    shippingSubtotal: number;
    buyerServiceFee: number;
    handlingFee: number;
    damageProtectionFee: number;
    discount: number;
    total: number;
  };
}

export interface DraftShippingResponse {
  id: string;
  label: string;
  estimate: string;
  // Integer IDR for one shipment. Each shop in the draft ships separately.
  price: number;
}

interface ShippingOptionLike {
  id: number;
  name: string;
  price: number;
  minDays: number;
  maxDays: number;
  channel: { name: string };
}

// "JNE Regular", "Estimated arrival 3-5 days".
export function toShippingResponse(option: ShippingOptionLike): DraftShippingResponse {
  const { minDays, maxDays } = option;
  const days = minDays === maxDays ? `${maxDays}` : `${minDays}-${maxDays}`;
  const estimate = maxDays <= 1 && minDays === 0 ? 'Estimated arrival within 1 day' : `Estimated arrival ${days} ${maxDays === 1 ? 'day' : 'days'}`;
  return { id: String(option.id), label: `${option.channel.name} ${option.name}`, estimate, price: option.price };
}

// The shipping channels every shop in the draft supports. A shop that has not set its channels yet
// does not restrict the choice. null means every channel (no shop has set any).
export function allowedChannelIds(record: DraftRecord): number[] | null {
  const shops = new Map<string, number[]>();
  for (const item of record.items) {
    const { shop, isActive } = item.cartItem.variant.product;
    if (!isActive) continue;
    shops.set(shop.slug, shop.shippingChannels.map((channel) => channel.shippingChannelId));
  }
  const restricting = [...shops.values()].filter((channels) => channels.length > 0);
  if (restricting.length === 0) return null;
  return restricting.reduce((common, channels) => common.filter((id) => channels.includes(id)));
}

// The money a voucher is checked against: the product subtotal, each shop's part of it, and the
// chosen shipping price (null when none is chosen, or when the chosen one cannot be used).
export function checkoutMoney(record: DraftRecord): CheckoutMoney {
  const shopSubtotals = new Map<number, number>();
  let productSubtotal = 0;
  for (const item of record.items) {
    const { variant, quantity } = item.cartItem;
    if (!variant.product.isActive) continue;
    const line = calculateLineTotal(variant.price, quantity);
    productSubtotal += line;
    const shopId = variant.product.shop.id;
    shopSubtotals.set(shopId, (shopSubtotals.get(shopId) ?? 0) + line);
  }
  const option = usableShippingOption(record);
  return { productSubtotal, shopSubtotals, shippingPrice: option ? option.price : null, shipmentCount: shipmentCount(record) };
}

// The chosen option counts only while it is still active and every shop can use it.
export function usableShippingOption(record: DraftRecord): DraftRecord['shippingOption'] {
  const channels = allowedChannelIds(record);
  const option = record.shippingOption;
  return option !== null && option.isActive && (channels === null || channels.includes(option.channelId)) ? option : null;
}

export function toVoucherRule(voucher: NonNullable<DraftRecord['voucher']>): VoucherRule {
  return {
    type: voucher.type,
    value: voucher.value,
    maxDiscount: voucher.maxDiscount,
    minSpend: voucher.minSpend,
    shopId: voucher.shopId,
    startsAt: voucher.startsAt,
    endsAt: voucher.endsAt,
    usageLimit: voucher.usageLimit,
    usedCount: voucher.usedCount,
    isActive: voucher.isActive,
  };
}

// One shipment per shop: the number of different shops among the items that can be bought.
export function shipmentCount(record: DraftRecord): number {
  return new Set(
    record.items
      .filter((item) => item.cartItem.variant.product.isActive)
      .map((item) => item.cartItem.variant.product.shop.slug),
  ).size;
}

function toRegionRef(region: { id: string; name: string }): RegionRef {
  return { id: region.id, name: region.name };
}

// The address is complete only when all eight fields are set. A partial address is
// never returned (and never saved), so the answer is the whole address or null.
export function toAddress(record: DraftRecord): DraftAddressResponse | null {
  const { addressLabel, addressStreet, recipientName, phone, province, city, district, subDistrict } = record;
  if (
    !addressLabel ||
    !addressStreet ||
    !recipientName ||
    !phone ||
    !province ||
    !city ||
    !district ||
    !subDistrict
  ) {
    return null;
  }
  return {
    label: addressLabel,
    street: addressStreet,
    recipientName,
    phone,
    province: toRegionRef(province),
    city: toRegionRef(city),
    district: toRegionRef(district),
    subDistrict: toRegionRef(subDistrict),
  };
}

// Prices, quantities and stock are read from the cart item and variant now.
// Items of inactive products are left out of the items and the subtotal, and counted
// in unavailableItemCount so the frontend can tell the user.
export function toDraftResponse(record: DraftRecord, now: Date = new Date()): DraftResponse {
  const available = record.items.filter((item) => item.cartItem.variant.product.isActive);

  const items = [...available]
    .sort((a, b) =>
      compareCartLines(
        {
          id: a.id,
          shopName: a.cartItem.variant.product.shop.name,
          productName: a.cartItem.variant.product.name,
          productId: a.cartItem.variant.product.id,
          variantPosition: a.cartItem.variant.position,
        },
        {
          id: b.id,
          shopName: b.cartItem.variant.product.shop.name,
          productName: b.cartItem.variant.product.name,
          productId: b.cartItem.variant.product.id,
          variantPosition: b.cartItem.variant.position,
        },
      ),
    )
    .map(
      (item): DraftItemResponse => {
        const { variant, quantity } = item.cartItem;
        return {
          id: String(item.id),
          quantity,
          product: {
            id: String(variant.product.id),
            slug: variant.product.slug,
            name: variant.product.name,
            imageUrl: toImageUrl(variant.product.imageUrl),
            shop: { slug: variant.product.shop.slug, name: variant.product.shop.name },
          },
          variant: {
            id: String(variant.id),
            label: variant.label,
            unit: variant.unit,
            price: variant.price,
            stock: variant.stock,
          },
        };
      },
    );

  const productSubtotal = items.reduce(
    (sum, item) => sum + calculateLineTotal(item.variant.price, item.quantity),
    0,
  );
  const option = usableShippingOption(record);
  const shipping = option ? toShippingResponse(option) : null;
  const method = record.paymentMethod;
  const paymentMethod = method && method.isEnabled ? { id: String(method.id), label: method.name } : null;

  // A chosen voucher counts only while it can still be used on this checkout.
  const chosen = record.voucher;
  const discount = chosen ? voucherDiscount(toVoucherRule(chosen), checkoutMoney(record), now) : null;
  const voucher =
    chosen && discount !== null ? { id: String(chosen.id), title: chosen.title, code: chosen.code, discountAmount: discount } : null;

  // The buyer service fee and the handling fee are not set yet, so they are 0.
  const protectionFee = damageProtectionFee(productSubtotal);
  const amounts = {
    productSubtotal,
    shippingSubtotal: shipping ? shipping.price * shipmentCount(record) : 0,
    buyerServiceFee: 0,
    handlingFee: 0,
    damageProtectionFee: record.damageProtectionEnabled ? protectionFee : 0,
    discount: voucher?.discountAmount ?? 0,
  };

  return {
    items,
    unavailableItemCount: record.items.length - available.length,
    address: toAddress(record),
    // The fee is shown before the buyer turns protection on.
    damageProtection: { enabled: record.damageProtectionEnabled, fee: protectionFee },
    shipping,
    voucher,
    paymentMethod,
    summary: { ...amounts, total: calculateCheckoutTotal(amounts) },
  };
}
