import { describe, expect, it } from 'vitest';
import { slugCandidate, slugify } from '../../src/lib/slug.js';

describe('slugify', () => {
  it.each([
    ['Bali Fresh Farm', 'bali-fresh-farm'],
    ["Bali's Fresh Farm!", 'bali-s-fresh-farm'],
    ['  Many   spaces  ', 'many-spaces'],
    ['Café Ñandú', 'cafe-nandu'],
    ['Toko 88', 'toko-88'],
    ['--Dashes--', 'dashes'],
  ])('turns "%s" into "%s"', (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });

  it('falls back to "shop" when nothing usable is left', () => {
    expect(slugify('!!!')).toBe('shop');
    expect(slugify('日本')).toBe('shop');
  });

  it('keeps the slug short and never ends it with a dash', () => {
    const slug = slugify(`${'a'.repeat(59)} bbbb`);

    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('gives the same slug for names that differ only in punctuation', () => {
    expect(slugify('Fresh Farm!')).toBe(slugify('Fresh Farm?'));
  });
});

describe('slugCandidate', () => {
  it('uses the plain slug first, then adds a number', () => {
    expect(slugCandidate('farm', 1)).toBe('farm');
    expect(slugCandidate('farm', 2)).toBe('farm-2');
    expect(slugCandidate('farm', 3)).toBe('farm-3');
  });
});
