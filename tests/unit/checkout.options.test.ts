import { describe, expect, it } from 'vitest';
import { allowedChannelIds, shipmentCount, toDraftResponse, toShippingResponse } from '../../src/services/checkout.mapper.js';
import { buildDraft } from '../helpers/draftRecord.js';

const JNE = 1;
const JNT = 2;

const option = (overrides: Partial<{ id: number; channelId: number; price: number; minDays: number; maxDays: number; isActive: boolean }> = {}) => ({
  id: 7,
  name: 'Regular',
  price: 12000,
  minDays: 3,
  maxDays: 5,
  isActive: true,
  channelId: JNE,
  channel: { name: 'JNE' },
  ...overrides,
});

describe('toShippingResponse', () => {
  it('names the option with its channel and gives the arrival estimate', () => {
    expect(toShippingResponse(option())).toEqual({ id: '7', label: 'JNE Regular', estimate: 'Estimated arrival 3-5 days', price: 12000 });
    expect(toShippingResponse(option({ minDays: 2, maxDays: 2 })).estimate).toBe('Estimated arrival 2 days');
    expect(toShippingResponse(option({ minDays: 1, maxDays: 1 })).estimate).toBe('Estimated arrival 1 day');
    expect(toShippingResponse(option({ minDays: 0, maxDays: 1 })).estimate).toBe('Estimated arrival within 1 day');
  });
});

describe('allowedChannelIds', () => {
  it('is every channel when no shop has set its channels', () => {
    expect(allowedChannelIds(buildDraft([{ id: 1 }]))).toBeNull();
  });

  it('is the channels every shop supports; a shop without channels does not restrict', () => {
    const draft = buildDraft([
      { id: 1, shopSlug: 'a', channelIds: [JNE, JNT] },
      { id: 2, shopSlug: 'b', channelIds: [JNE] },
      { id: 3, shopSlug: 'c', channelIds: [] },
    ]);
    expect(allowedChannelIds(draft)).toEqual([JNE]);
  });

  it('can be empty when the shops share no channel', () => {
    const draft = buildDraft([
      { id: 1, shopSlug: 'a', channelIds: [JNE] },
      { id: 2, shopSlug: 'b', channelIds: [JNT] },
    ]);
    expect(allowedChannelIds(draft)).toEqual([]);
  });

  it('ignores items of inactive products', () => {
    const draft = buildDraft([
      { id: 1, shopSlug: 'a', channelIds: [JNE] },
      { id: 2, shopSlug: 'b', channelIds: [JNT], isActive: false },
    ]);
    expect(allowedChannelIds(draft)).toEqual([JNE]);
  });
});

describe('the draft with shipping and payment', () => {
  it('charges one shipment per shop', () => {
    const draft = buildDraft(
      [
        { id: 1, shopSlug: 'a', price: 10000 },
        { id: 2, shopSlug: 'a', price: 5000 },
        { id: 3, shopSlug: 'b', price: 1000 },
      ],
      { shippingOption: option() },
    );

    expect(shipmentCount(draft)).toBe(2);
    const response = toDraftResponse(draft);
    expect(response.shipping).toEqual({ id: '7', label: 'JNE Regular', estimate: 'Estimated arrival 3-5 days', price: 12000 });
    expect(response.summary.shippingSubtotal).toBe(24000);
    expect(response.summary.total).toBe(16000 + 24000);
  });

  it('drops a chosen option that is switched off, or that a shop cannot use', () => {
    expect(toDraftResponse(buildDraft([{ id: 1 }], { shippingOption: option({ isActive: false }) })).shipping).toBeNull();
    const draft = buildDraft([{ id: 1, channelIds: [JNT] }], { shippingOption: option({ channelId: JNE }) });
    expect(toDraftResponse(draft).shipping).toBeNull();
    expect(toDraftResponse(draft).summary.shippingSubtotal).toBe(0);
  });

  it('shows the chosen payment method while it is enabled', () => {
    expect(toDraftResponse(buildDraft([{ id: 1 }], { paymentMethod: { id: 3, name: 'QRIS', isEnabled: true } })).paymentMethod).toEqual({
      id: '3',
      label: 'QRIS',
    });
    expect(toDraftResponse(buildDraft([{ id: 1 }], { paymentMethod: { id: 3, name: 'QRIS', isEnabled: false } })).paymentMethod).toBeNull();
  });
});
