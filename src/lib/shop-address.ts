import type { FieldErrors } from './errors.js';
import { checkRegionParents } from './region-chain.js';
import type { RegionIds, RegionParents } from '../repositories/region.repository.js';

const BODY_FIELD = {
  province: 'provinceId',
  city: 'cityId',
  district: 'districtId',
  subDistrict: 'subDistrictId',
} as const;

// The same region chain rule as the profile and checkout addresses (the city belongs to the
// province, and so on). The shop form sends flat ids, so errors are named after those fields.
export function checkShopRegions(ids: RegionIds, found: RegionParents): FieldErrors {
  const errors: FieldErrors = {};
  for (const [field, message] of Object.entries(checkRegionParents(ids, found))) {
    errors[BODY_FIELD[field as keyof typeof BODY_FIELD]] = message;
  }
  return errors;
}
