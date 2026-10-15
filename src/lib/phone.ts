// Profile phone rule: an optional leading "+", then 8 to 15 digits. Stored as given (after trimming).
export const PROFILE_PHONE_PATTERN = /^\+?[0-9]{8,15}$/;

export function isValidProfilePhone(phone: string): boolean {
  return PROFILE_PHONE_PATTERN.test(phone);
}

// The checkout address accepts digits only, so the copy from the profile drops the leading "+".
// The input must already be a valid profile phone. This is the one place to change the rule
// (for example to turn "+62812..." into "0812...").
export function toCheckoutPhone(profilePhone: string): string {
  return profilePhone.replace(/^\+/, '');
}
