import { describe, expect, it } from 'vitest';
import { isClosingAfterOpening, isValidTime, toOperatingHours } from '../../src/lib/shop-hours.js';

describe('isValidTime', () => {
  it.each(['00:00', '09:00', '19:30', '23:59'])('accepts "%s"', (time) => {
    expect(isValidTime(time)).toBe(true);
  });

  it.each(['24:00', '9:00', '09:60', '9', '09-00', '09:0', '', '09:00:00', ' 09:00'])('rejects "%s"', (time) => {
    expect(isValidTime(time)).toBe(false);
  });
});

describe('isClosingAfterOpening', () => {
  it('accepts opening before closing', () => {
    expect(isClosingAfterOpening('09:00', '19:00')).toBe(true);
    expect(isClosingAfterOpening('00:00', '23:59')).toBe(true);
  });

  it('rejects overnight hours', () => {
    expect(isClosingAfterOpening('19:00', '09:00')).toBe(false);
  });

  it('rejects equal times', () => {
    expect(isClosingAfterOpening('09:00', '09:00')).toBe(false);
  });

  it('rejects times that are not valid', () => {
    expect(isClosingAfterOpening('9:00', '19:00')).toBe(false);
    expect(isClosingAfterOpening('09:00', '24:00')).toBe(false);
  });
});

describe('toOperatingHours', () => {
  it('returns the stored times', () => {
    expect(toOperatingHours('09:00', '19:00')).toEqual({ open: '09:00', close: '19:00' });
  });

  it('returns 00:00 and 00:00 when no hours are stored', () => {
    expect(toOperatingHours(null, null)).toEqual({ open: '00:00', close: '00:00' });
  });
});
