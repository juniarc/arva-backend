import { describe, expect, it } from 'vitest';
import { isValidProfilePhone, toCheckoutPhone } from '../../src/lib/phone.js';

describe('isValidProfilePhone', () => {
  it.each(['+6281234567890', '081234567890', '12345678', '123456789012345', '+12345678'])(
    'accepts "%s"',
    (phone) => {
      expect(isValidProfilePhone(phone)).toBe(true);
    },
  );

  it.each(['12-34', 'abc', '+12', '1234567', '1234567890123456', '+62 812', '0812 3456 7890', '++6281234567', '', '08123abc890'])(
    'rejects "%s"',
    (phone) => {
      expect(isValidProfilePhone(phone)).toBe(false);
    },
  );
});

describe('toCheckoutPhone', () => {
  it('strips the leading plus so the result is digits only', () => {
    expect(toCheckoutPhone('+6281234567890')).toBe('6281234567890');
    expect(toCheckoutPhone('+6281234567890')).toMatch(/^[0-9]{8,15}$/);
  });

  it('leaves a phone without a plus as it is', () => {
    expect(toCheckoutPhone('081234567890')).toBe('081234567890');
  });
});
