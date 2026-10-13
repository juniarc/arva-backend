import type { FieldErrors } from './errors.js';
import type { RegionIds, RegionParents } from '../repositories/region.repository.js';

// Region ids are wilayah.id codes, and each code starts with its parent's code ("3171" is in "31").
function startsWithParent(childId: string, parentId: string): boolean {
  return childId.length > parentId.length && childId.startsWith(parentId);
}

// Each region must exist, and each child must belong to the parent the user chose.
// A child whose code does not start with its parent's code is rejected even before it is looked
// up. Otherwise the parent stored in the database decides. Shared by the checkout, profile and
// shop addresses.
export function checkRegionParents(ids: RegionIds, found: RegionParents): FieldErrors {
  const errors: FieldErrors = {};
  if (!found.province) {
    errors.province = 'Province not found.';
  }

  if (!startsWithParent(ids.cityId, ids.provinceId)) {
    errors.city = 'This city is not in the selected province.';
  } else if (!found.city) {
    errors.city = 'City not found.';
  } else if (found.city.provinceId !== ids.provinceId) {
    errors.city = 'This city is not in the selected province.';
  }

  if (!startsWithParent(ids.districtId, ids.cityId)) {
    errors.district = 'This district is not in the selected city.';
  } else if (!found.district) {
    errors.district = 'District not found.';
  } else if (found.district.cityId !== ids.cityId) {
    errors.district = 'This district is not in the selected city.';
  }

  if (!startsWithParent(ids.subDistrictId, ids.districtId)) {
    errors.subDistrict = 'This sub-district is not in the selected district.';
  } else if (!found.subDistrict) {
    errors.subDistrict = 'Sub-district not found.';
  } else if (found.subDistrict.districtId !== ids.districtId) {
    errors.subDistrict = 'This sub-district is not in the selected district.';
  }
  return errors;
}
