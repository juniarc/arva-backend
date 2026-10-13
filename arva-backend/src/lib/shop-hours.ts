// Shop opening hours are text in the form "HH:MM" (24 hour). Overnight hours are not supported.
export const HH_MM_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

// Returned when a shop has no hours saved. The API does not invent hours.
export const NO_HOURS = '00:00';

export function isValidTime(time: string): boolean {
  return HH_MM_PATTERN.test(time);
}

// Both times must be valid, and closing must be later than opening.
// Valid "HH:MM" strings sort like clock times, so a plain comparison is enough.
export function isClosingAfterOpening(opening: string, closing: string): boolean {
  return isValidTime(opening) && isValidTime(closing) && closing > opening;
}

export function toOperatingHours(
  openingTime: string | null,
  closingTime: string | null,
): { open: string; close: string } {
  return { open: openingTime ?? NO_HOURS, close: closingTime ?? NO_HOURS };
}
