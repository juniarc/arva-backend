import { compareCartLines } from '../lib/cart-order.js';
import { calculateCheckoutTotal } from '../lib/checkout-total.js';
import { toImageUrl } from '../lib/imageUrl.js';
import { calculateLineTotal } from '../lib/money.js';
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
  // Placeholders. The next checkout tasks fill them in.
  shipping: null;
  voucher: null;
  paymentMethod: null;
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

function toRegionRef(region: { id: number; name: string }): RegionRef {
  return { id: String(region.id), name: region.name };
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
export function toDraftResponse(record: DraftRecord): DraftResponse {
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
  // Shipping, fees and discount are 0 until the next checkout tasks add them.
  const amounts = {
    productSubtotal,
    shippingSubtotal: 0,
    buyerServiceFee: 0,
    handlingFee: 0,
    damageProtectionFee: 0,
    discount: 0,
  };

  return {
    items,
    unavailableItemCount: record.items.length - available.length,
    address: toAddress(record),
    damageProtection: { enabled: record.damageProtectionEnabled, fee: amounts.damageProtectionFee },
    shipping: null,
    voucher: null,
    paymentMethod: null,
    summary: { ...amounts, total: calculateCheckoutTotal(amounts) },
  };
}
