import { NotFoundError, StockConflictError, ValidationError } from '../lib/errors.js';
import { toImageUrl } from '../lib/imageUrl.js';
import { calculateLineTotal } from '../lib/money.js';
import { cartRepository, type CartItemRecord } from '../repositories/cart.repository.js';
import { MAX_CART_QUANTITY, type AddToCartInput } from '../schemas/cart.schema.js';

export interface CartItemResponse {
  id: string;
  quantity: number;
  product: { id: string; slug: string; name: string; imageUrl: string; shopName: string };
  variant: { id: string; label: string; unit: string; price: number; stock: number };
}

export interface CartResponse {
  items: CartItemResponse[];
  itemCount: number;
  subtotal: number;
}

// The cart shows the variant's CURRENT price. No price is copied into the cart row.
// Checkout will need to snapshot prices into the order.
function toCartResponse(records: CartItemRecord[]): CartResponse {
  const items = records.map((item) => ({
    id: String(item.id),
    quantity: item.quantity,
    product: {
      id: String(item.variant.product.id),
      slug: item.variant.product.slug,
      name: item.variant.product.name,
      imageUrl: toImageUrl(item.variant.product.imageUrl),
      shopName: item.variant.product.shop.name,
    },
    variant: {
      id: String(item.variant.id),
      label: item.variant.label,
      unit: item.variant.unit,
      price: item.variant.price,
      stock: item.variant.stock,
    },
  }));

  return {
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce(
      (sum, item) => sum + calculateLineTotal(item.variant.price, item.quantity),
      0,
    ),
  };
}

async function getCart(userId: number): Promise<CartResponse> {
  return toCartResponse(await cartRepository.findByUser(userId));
}

async function addToCart(userId: number, input: AddToCartInput): Promise<CartResponse> {
  const variantId = Number(input.variantId);

  // Stock is checked here but NOT reserved. It is checked again at checkout.
  // The check and the write share one transaction, and the variant row is locked,
  // so two parallel adds cannot both pass the check.
  await cartRepository.runInTransaction(async (tx) => {
    const variant = await tx.lockActiveVariant(variantId);
    if (!variant) {
      throw new NotFoundError('Product not found.');
    }
    if (variant.stock === 0) {
      throw new StockConflictError('OUT_OF_STOCK', 'This variant is out of stock.');
    }

    const inCart = await tx.findQuantity(userId, variantId);
    const newTotal = inCart + input.quantity;

    if (newTotal > variant.stock) {
      const remaining = Math.max(variant.stock - inCart, 0);
      throw new StockConflictError('INSUFFICIENT_STOCK', `Only ${remaining} left in stock.`);
    }
    if (newTotal > MAX_CART_QUANTITY) {
      throw new ValidationError('Please fix the highlighted fields.', {
        quantity: `You can add at most ${MAX_CART_QUANTITY} of one item to your cart.`,
      });
    }

    await tx.saveQuantity(userId, variantId, newTotal);
  });

  return getCart(userId);
}

export const cartService = { getCart, addToCart };
