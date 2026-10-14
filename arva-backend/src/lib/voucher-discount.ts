// Money is integer IDR. The one place a voucher's discount on a checkout is worked out.

export type VoucherKind = 'PERCENT' | 'FIXED' | 'FREE_SHIPPING';

export interface VoucherRule {
  type: VoucherKind;
  // PERCENT: percent off. FIXED: IDR off. FREE_SHIPPING: the most IDR of shipping covered.
  value: number;
  maxDiscount: number | null;
  minSpend: number;
  // Null for a platform voucher.
  shopId: number | null;
  startsAt: Date;
  endsAt: Date;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
}

export interface CheckoutMoney {
  productSubtotal: number;
  // Product subtotal of each shop in the checkout, by shop id.
  shopSubtotals: Map<number, number>;
  // The chosen option's price for one shipment, or null when none is chosen yet.
  shippingPrice: number | null;
  // One shipment per shop.
  shipmentCount: number;
}

// The discount the voucher gives on this checkout, or null when it cannot be used on it:
// switched off, outside its dates, used up, for a shop that is not in the checkout, or the
// minimum spend is not reached. A shop voucher counts that shop's products only.
// A free-shipping voucher gives 0 until a shipping option is chosen.
export function voucherDiscount(voucher: VoucherRule, money: CheckoutMoney, now: Date): number | null {
  if (!voucher.isActive || now < voucher.startsAt || now > voucher.endsAt) return null;
  if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) return null;

  const base = voucher.shopId === null ? money.productSubtotal : money.shopSubtotals.get(voucher.shopId);
  if (base === undefined || base === 0 || base < voucher.minSpend) return null;

  switch (voucher.type) {
    case 'PERCENT': {
      const discount = Math.floor((base * voucher.value) / 100);
      return voucher.maxDiscount === null ? discount : Math.min(discount, voucher.maxDiscount);
    }
    case 'FIXED':
      return Math.min(voucher.value, base);
    case 'FREE_SHIPPING': {
      if (money.shippingPrice === null) return 0;
      // A shop voucher covers that shop's shipment; a platform voucher covers all of them.
      const shipping = voucher.shopId === null ? money.shippingPrice * money.shipmentCount : money.shippingPrice;
      return Math.min(voucher.value, shipping);
    }
  }
}
