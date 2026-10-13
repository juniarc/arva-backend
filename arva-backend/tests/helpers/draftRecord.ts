import type { DraftRecord } from '../../src/repositories/checkout.repository.js';

interface ItemInput {
  id: number;
  quantity?: number;
  price?: number;
  stock?: number;
  isActive?: boolean;
  shopName?: string;
  productName?: string;
  productId?: number;
  position?: number;
}

const NAMED = (id: string, name: string) => ({ id, name });

export const fullAddress = {
  addressLabel: 'Home',
  addressStreet: 'Jl. Mawar 1',
  recipientName: 'Alice',
  phone: '081234567890',
  province: NAMED('31', 'DKI Jakarta'),
  city: NAMED('3171', 'Kota Administrasi Jakarta Pusat'),
  district: NAMED('317107', 'Tanah Abang'),
  subDistrict: NAMED('3171071001', 'Gelora'),
} satisfies Partial<DraftRecord>;

// Builds a draft record the way the repository returns it.
export function buildDraft(items: ItemInput[], overrides: Partial<DraftRecord> = {}): DraftRecord {
  return {
    addressLabel: null,
    addressStreet: null,
    recipientName: null,
    phone: null,
    damageProtectionEnabled: false,
    province: null,
    city: null,
    district: null,
    subDistrict: null,
    items: items.map((item) => ({
      id: item.id,
      cartItem: {
        quantity: item.quantity ?? 1,
        variant: {
          id: item.id * 10,
          label: '1 kg',
          unit: 'kg',
          price: item.price ?? 1000,
          stock: item.stock ?? 10,
          position: item.position ?? 0,
          product: {
            id: item.productId ?? item.id,
            slug: `p${item.id}`,
            name: item.productName ?? `P${item.id}`,
            imageUrl: '/images/dummy/x.jpg',
            isActive: item.isActive ?? true,
            shop: { slug: 'shop', name: item.shopName ?? 'Shop' },
          },
        },
      },
    })),
    ...overrides,
  };
}
