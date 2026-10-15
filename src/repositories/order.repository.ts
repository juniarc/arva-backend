import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { readDraft, type DraftRecord } from './checkout.repository.js';

export interface NewOrderData {
  code: string;
  userId: number;
  status: 'PAID';
  paidAt: Date;
  addressLabel: string;
  addressStreet: string;
  recipientName: string;
  phone: string;
  provinceName: string;
  cityName: string;
  districtName: string;
  subDistrictName: string;
  shippingLabel: string;
  shippingPrice: number;
  shipmentCount: number;
  paymentMethodName: string;
  voucherCode: string | null;
  productSubtotal: number;
  shippingSubtotal: number;
  buyerServiceFee: number;
  handlingFee: number;
  damageProtectionFee: number;
  discount: number;
  total: number;
  items: {
    productId: number;
    variantId: number;
    shopId: number;
    shopName: string;
    productName: string;
    variantLabel: string;
    unit: string;
    price: number;
    quantity: number;
    lineTotal: number;
    imageUrl: string;
  }[];
}

// An order code that another order took at the same moment.
export class OrderCodeTakenError extends Error {
  constructor() {
    super('Order code is taken.');
    this.name = 'OrderCodeTakenError';
  }
}

// The steps of placing an order, all inside one database transaction: if any step fails,
// nothing is kept (no stock is taken, no voucher is used, the cart stays).
export interface OrderTransaction {
  findDraft(userId: number): Promise<DraftRecord | null>;
  // Takes `quantity` off the variant's stock. False when there is not enough (nothing changes).
  takeStock(variantId: number, quantity: number): Promise<boolean>;
  // Counts one use of the voucher. False when it is used up (nothing changes).
  useVoucher(voucherId: number, usageLimit: number | null): Promise<boolean>;
  createOrder(data: NewOrderData): Promise<{ id: number; code: string }>;
  // Raises the product's sold count once the order is paid.
  addSold(productId: number, quantity: number): Promise<void>;
  // Removes the bought cart items (their checkout lines go with them) and the draft.
  clearCheckout(userId: number, cartItemIds: number[]): Promise<void>;
}

function createTransaction(tx: Prisma.TransactionClient): OrderTransaction {
  return {
    findDraft: (userId) => readDraft(tx, userId),

    async takeStock(variantId, quantity) {
      const updated = await tx.productVariant.updateMany({
        where: { id: variantId, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } },
      });
      return updated.count === 1;
    },

    async useVoucher(voucherId, usageLimit) {
      const updated = await tx.voucher.updateMany({
        where: { id: voucherId, ...(usageLimit === null ? {} : { usedCount: { lt: usageLimit } }) },
        data: { usedCount: { increment: 1 } },
      });
      return updated.count === 1;
    },

    async createOrder({ items, ...order }) {
      try {
        return await tx.order.create({ data: { ...order, items: { create: items } }, select: { id: true, code: true } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new OrderCodeTakenError();
        }
        throw error;
      }
    },

    async addSold(productId, quantity) {
      await tx.product.update({ where: { id: productId }, data: { soldCount: { increment: quantity } } });
    },

    async clearCheckout(userId, cartItemIds) {
      await tx.cartItem.deleteMany({ where: { userId, id: { in: cartItemIds } } });
      await tx.checkoutDraft.deleteMany({ where: { userId } });
    },
  };
}

// The buyer's order history. userId is used only to filter: it is never selected.
const orderHistorySelect = {
  id: true,
  code: true,
  status: true,
  createdAt: true,
  paidAt: true,
  addressLabel: true,
  addressStreet: true,
  recipientName: true,
  phone: true,
  provinceName: true,
  cityName: true,
  districtName: true,
  subDistrictName: true,
  shippingLabel: true,
  shippingPrice: true,
  shipmentCount: true,
  paymentMethodName: true,
  voucherCode: true,
  productSubtotal: true,
  shippingSubtotal: true,
  buyerServiceFee: true,
  handlingFee: true,
  damageProtectionFee: true,
  discount: true,
  total: true,
  items: {
    orderBy: { id: 'asc' },
    select: {
      id: true,
      shopName: true,
      productName: true,
      variantLabel: true,
      unit: true,
      price: true,
      quantity: true,
      lineTotal: true,
      imageUrl: true,
      product: { select: { slug: true, isActive: true } },
      shop: { select: { slug: true } },
    },
  },
} satisfies Prisma.OrderSelect;

export type OrderHistoryRecord = Prisma.OrderGetPayload<{ select: typeof orderHistorySelect }>;

export const orderRepository = {
  findOrders(userId: number, skip: number, take: number): Promise<OrderHistoryRecord[]> {
    return prisma.order.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take,
      select: orderHistorySelect,
    });
  },

  countOrders(userId: number): Promise<number> {
    return prisma.order.count({ where: { userId } });
  },

  runInTransaction<T>(work: (tx: OrderTransaction) => Promise<T>): Promise<T> {
    return prisma.$transaction((tx) => work(createTransaction(tx)));
  },
};
