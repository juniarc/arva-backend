// Damage protection (3 months) costs 1% of the product subtotal, rounded to whole rupiah,
// and never less than Rp 1.000. The buyer sees the price before turning it on.
export const DAMAGE_PROTECTION_PERCENT = 1;
export const DAMAGE_PROTECTION_MINIMUM = 1000;

export function damageProtectionFee(productSubtotal: number): number {
  return Math.max(DAMAGE_PROTECTION_MINIMUM, Math.round((productSubtotal * DAMAGE_PROTECTION_PERCENT) / 100));
}
