import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { findSelectedCartItems, type SelectedCartItem } from './cart-draft.repository.js';

// userId, the draft id and timestamps are never selected, so they cannot reach the API.
const draftSelect = {
  addressLabel: true,
  addressStreet: true,
  recipientName: true,
  phone: true,
  damageProtectionEnabled: true,
  province: { select: { id: true, name: true } },
  city: { select: { id: true, name: true } },
  district: { select: { id: true, name: true } },
  subDistrict: { select: { id: true, name: true } },
  items: {
    orderBy: { id: 'asc' },
    select: {
      id: true,
      cartItem: {
        select: {
          quantity: true,
          variant: {
            select: {
              id: true,
              label: true,
              unit: true,
              price: true,
              stock: true,
              position: true,
              product: {
                select: {
                  id: true,
                  slug: true,
                  name: true,
                  imageUrl: true,
                  isActive: true,
                  shop: { select: { slug: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CheckoutDraftSelect;

export type DraftRecord = Prisma.CheckoutDraftGetPayload<{ select: typeof draftSelect }>;

export interface DraftAddressData {
  label: string;
  street: string;
  recipientName: string;
  phone: string;
  provinceId: number;
  cityId: number;
  districtId: number;
  subDistrictId: number;
}

// The steps the service takes inside one database transaction.
export interface CheckoutTransaction {
  findSelectedCartItems(userId: number, cartItemIds: number[]): Promise<SelectedCartItem[]>;
  replaceDraft(userId: number, cartItemIds: number[]): Promise<void>;
  // All address fields in one UPDATE. Returns false when the user has no draft.
  saveAddress(userId: number, address: DraftAddressData): Promise<boolean>;
  findDraft(userId: number): Promise<DraftRecord | null>;
}

type Client = Prisma.TransactionClient | typeof prisma;

function readDraft(client: Client, userId: number): Promise<DraftRecord | null> {
  return client.checkoutDraft.findUnique({ where: { userId }, select: draftSelect });
}

function createTransaction(client: Prisma.TransactionClient): CheckoutTransaction {
  return {
    findSelectedCartItems: (userId, cartItemIds) => findSelectedCartItems(client, userId, cartItemIds),

    // Gives the user a brand new draft: no address, damage protection off, only these items.
    // The draft row is reset in one upsert (the unique userId keeps it safe when two requests
    // race), then its items are replaced.
    async replaceDraft(userId, cartItemIds) {
      const draft = await client.checkoutDraft.upsert({
        where: { userId },
        create: { userId },
        update: {
          addressLabel: null,
          addressStreet: null,
          recipientName: null,
          phone: null,
          provinceId: null,
          cityId: null,
          districtId: null,
          subDistrictId: null,
          damageProtectionEnabled: false,
        },
        select: { id: true },
      });
      await client.checkoutDraftItem.deleteMany({ where: { draftId: draft.id } });
      await client.checkoutDraftItem.createMany({
        data: cartItemIds.map((cartItemId) => ({ draftId: draft.id, cartItemId })),
      });
    },

    async saveAddress(userId, address) {
      const updated = await client.checkoutDraft.updateMany({
        where: { userId },
        data: {
          addressLabel: address.label,
          addressStreet: address.street,
          recipientName: address.recipientName,
          phone: address.phone,
          provinceId: address.provinceId,
          cityId: address.cityId,
          districtId: address.districtId,
          subDistrictId: address.subDistrictId,
        },
      });
      return updated.count > 0;
    },

    findDraft: (userId) => readDraft(client, userId),
  };
}

function runInTransaction<T>(work: (tx: CheckoutTransaction) => Promise<T>): Promise<T> {
  return prisma.$transaction((client) => work(createTransaction(client)));
}

function findDraft(userId: number): Promise<DraftRecord | null> {
  return readDraft(prisma, userId);
}

async function draftExists(userId: number): Promise<boolean> {
  const draft = await prisma.checkoutDraft.findUnique({ where: { userId }, select: { id: true } });
  return draft !== null;
}

export const checkoutRepository = { runInTransaction, findDraft, draftExists };
