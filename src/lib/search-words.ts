// The words of a search box, for "every word must match" searches.
// "  Bali   banana " gives ["bali", "banana"]. At most 5 words, so a long paste stays cheap.
export const MAX_SEARCH_WORDS = 5;

export function searchWords(query: string): string[] {
  return [...new Set(query.trim().toLowerCase().split(/\s+/).filter(Boolean))].slice(0, MAX_SEARCH_WORDS);
}
