import bcrypt from 'bcrypt';

// bcrypt with cost factor 12 (about 250 ms per hash on a typical server).
const BCRYPT_COST = 12;

// A valid cost-12 hash of a throwaway string. Login compares against it when the
// username does not exist, so "unknown user" takes as long as "wrong password".
export const DUMMY_PASSWORD_HASH = '$2b$12$uoBZCMt9uSHu5KaRvUOAUeeJ590MvizbhhRFb7NFuJUgtNlb1rp7K';

export function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, BCRYPT_COST);
}

export function comparePassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}
