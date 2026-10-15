import { describe, expect, it } from 'vitest';
import { calculateCheckoutTotal, type CheckoutAmounts } from '../../src/lib/checkout-total.js';

const zero: CheckoutAmounts = {
  productSubtotal: 0,
  shippingSubtotal: 0,
  buyerServiceFee: 0,
  handlingFee: 0,
  damageProtectionFee: 0,
  discount: 0,
};

describe('calculateCheckoutTotal', () => {
  it('equals the product subtotal when everything else is 0', () => {
    expect(calculateCheckoutTotal({ ...zero, productSubtotal: 4000 })).toBe(4000);
  });

  it('adds every charge', () => {
    const total = calculateCheckoutTotal({
      productSubtotal: 4000,
      shippingSubtotal: 1000,
      buyerServiceFee: 200,
      handlingFee: 300,
      damageProtectionFee: 50,
      discount: 0,
    });

    expect(total).toBe(5550);
  });

  it('subtracts the discount', () => {
    expect(calculateCheckoutTotal({ ...zero, productSubtotal: 4000, shippingSubtotal: 1000, discount: 500 })).toBe(4500);
  });

  it('never goes below 0', () => {
    expect(calculateCheckoutTotal({ ...zero, productSubtotal: 100, discount: 500 })).toBe(0);
  });

  it('is 0 for an empty draft', () => {
    expect(calculateCheckoutTotal(zero)).toBe(0);
  });
});
