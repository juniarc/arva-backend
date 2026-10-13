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
