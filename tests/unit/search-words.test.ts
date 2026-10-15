import { describe, expect, it } from 'vitest';
import { searchWords } from '../../src/lib/search-words.js';

describe('searchWords', () => {
  it('splits on spaces, lower-cases and drops repeats', () => {
    expect(searchWords('  Bali   BANANA bali ')).toEqual(['bali', 'banana']);
  });

  it('keeps at most 5 words', () => {
    expect(searchWords('a b c d e f g')).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
