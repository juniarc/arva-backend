// Prisma reports the columns of a broken unique index in `meta.target`, usually as an array
// such as ["email"] or ["username_lower"]. Returns which user field it was, or null for any
// other unique index.
export function uniqueFieldFromTarget(target: unknown): 'username' | 'email' | null {
  const text = Array.isArray(target) ? target.join(',') : String(target ?? '');
  if (text.includes('email')) {
    return 'email';
  }
  if (text.includes('username')) {
    return 'username';
  }
  return null;
}

// The shop name index is a functional index (lower(name)) that Prisma does not know, so
// `meta.target` can be the index name ("shops_name_lower_key") instead of a column list.
export function isShopNameViolation(target: unknown): boolean {
  const text = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return text.includes('name');
}

// Which index a unique violation on the shops table broke, from Prisma's `meta.target`
// (a column list, or the index name for indexes Prisma does not know).
export function shopViolationFromTarget(target: unknown): 'slug' | 'owner' | 'name' | null {
  const text = Array.isArray(target) ? target.join(',') : String(target ?? '');
  if (text.includes('slug')) {
    return 'slug';
  }
  if (text.includes('owner')) {
    return 'owner';
  }
  return text.includes('name') ? 'name' : null;
}
