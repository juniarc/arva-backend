const MAX_SLUG_LENGTH = 60;

// "Bali's Fresh Farm!" becomes "bali-s-fresh-farm". Accents are dropped, anything that is not a
// letter or a number becomes a single "-", and the result never starts or ends with "-".
// A name with no usable characters gives "shop".
export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
  return slug === '' ? 'shop' : slug;
}

// The slug to try on attempt 1, 2, 3 ...: "farm", "farm-2", "farm-3".
export function slugCandidate(base: string, attempt: number): string {
  return attempt <= 1 ? base : `${base}-${attempt}`;
}
