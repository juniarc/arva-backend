// The order of cart lines, shared by the cart and the checkout draft so both screens
// list items the same way. Pure, so it can be tested without a database.

export interface CartLineKey {
  id: number;
  shopName: string;
  productName: string;
  productId: number;
  variantPosition: number;
}

// Shop name, product name, product id, variant position, line id.
// The product id and line id only break ties, so the order is always the same.
export function compareCartLines(a: CartLineKey, b: CartLineKey): number {
  return (
    a.shopName.localeCompare(b.shopName, 'en') ||
    a.productName.localeCompare(b.productName, 'en') ||
    a.productId - b.productId ||
    a.variantPosition - b.variantPosition ||
    a.id - b.id
  );
}
