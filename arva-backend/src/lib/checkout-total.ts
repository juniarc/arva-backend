// Money is always an integer number of IDR. The one place the checkout total is calculated.

export interface CheckoutAmounts {
  productSubtotal: number;
  shippingSubtotal: number;
  buyerServiceFee: number;
  handlingFee: number;
  damageProtectionFee: number;
  discount: number;
}

// total = all charges minus the discount. It never goes below 0.
export function calculateCheckoutTotal(amounts: CheckoutAmounts): number {
  const charges =
    amounts.productSubtotal +
    amounts.shippingSubtotal +
    amounts.buyerServiceFee +
    amounts.handlingFee +
    amounts.damageProtectionFee;
  return Math.max(charges - amounts.discount, 0);
}
