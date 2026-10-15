import { describe, expect, it } from 'vitest';
import { uniqueFieldFromTarget } from '../../src/lib/unique-violation.js';

describe('uniqueFieldFromTarget', () => {
  it('recognises the email index', () => {
    expect(uniqueFieldFromTarget(['email'])).toBe('email');
    expect(uniqueFieldFromTarget('users_email_key')).toBe('email');
  });

  it('recognises the username index (the lowercase column)', () => {
    expect(uniqueFieldFromTarget(['username_lower'])).toBe('username');
    expect(uniqueFieldFromTarget('users_username_lower_key')).toBe('username');
  });

  it('returns null for any other index', () => {
    expect(uniqueFieldFromTarget(['user_id'])).toBeNull();
    expect(uniqueFieldFromTarget(undefined)).toBeNull();
  });
});
