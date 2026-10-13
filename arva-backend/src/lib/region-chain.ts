import type { FieldErrors } from './errors.js';
import type { RegionIds, RegionParents } from '../repositories/region.repository.js';

// Each region must exist, and each child must belong to the parent the user chose.
// Shared by the checkout address and the profile address.
export function checkRegionParents(ids: RegionIds, found: RegionParents): FieldErrors {
  const errors: FieldErrors = {};
  if (!found.province) {
    errors.province = 'Province not found.';
  }
  if (!found.city) {
    errors.city = 'City not found.';
  } else if (found.city.provinceId !== ids.provinceId) {
    errors.city = 'This city is not in the selected province.';
  }
  if (!found.district) {
    errors.district = 'District not found.';
  } else if (found.district.cityId !== ids.cityId) {
    errors.district = 'This district is not in the selected city.';
  }
  if (!found.subDistrict) {
    errors.subDistrict = 'Sub-district not found.';
  } else if (found.subDistrict.districtId !== ids.districtId) {
    errors.subDistrict = 'This sub-district is not in the selected district.';
  }
  return errors;
}
