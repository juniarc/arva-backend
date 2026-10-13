import {
  ConflictError,
  UnauthorizedError,
  UniqueViolationError,
  ValidationError,
} from '../lib/errors.js';
import { checkRegionParents } from '../lib/region-chain.js';
import { profileRepository, type ProfileRecord } from '../repositories/profile.repository.js';
import type { RegionIds } from '../repositories/region.repository.js';
import type { UpdateProfileInput, UpsertAddressInput } from '../schemas/profile.schema.js';

interface RegionRef {
  id: string;
  name: string;
}

export interface ProfileResponse {
  user: {
    username: string;
    name: string;
    email: string;
    phone: string | null;
    photoUrl: string | null;
  };
  address: {
    street: string;
    subDistrict: RegionRef;
    district: RegionRef;
    city: RegionRef;
    province: RegionRef;
    zipCode: string;
  } | null;
}

const NOT_LOGGED_IN = 'Please log in.';

function toRegionRef(region: { id: string; name: string }): RegionRef {
  return { id: region.id, name: region.name };
}

// The one place a profile record becomes the API response. address is null when no row exists.
export function toProfileResponse(record: ProfileRecord): ProfileResponse {
  const { address } = record;
  return {
    user: {
      username: record.username,
      name: record.name,
      email: record.email,
      phone: record.phone,
      photoUrl: record.photoUrl,
    },
    address: address && {
      street: address.street,
      subDistrict: toRegionRef(address.subDistrict),
      district: toRegionRef(address.district),
      city: toRegionRef(address.city),
      province: toRegionRef(address.province),
      zipCode: address.zipCode,
    },
  };
}

function readOrFail(record: ProfileRecord | null): ProfileResponse {
  if (!record) {
    // A valid token for a user that no longer exists.
    throw new UnauthorizedError(NOT_LOGGED_IN);
  }
  return toProfileResponse(record);
}

// Reads from the database, not the token: the token can be older than the last change.
async function getProfile(userId: number): Promise<ProfileResponse> {
  return readOrFail(await profileRepository.findProfile(userId));
}

function conflictFor(field: 'username' | 'email'): ConflictError {
  return field === 'username'
    ? new ConflictError('This username is already taken.', 'username')
    : new ConflictError('This email is already used.', 'email');
}

async function updateProfile(userId: number, input: UpdateProfileInput): Promise<ProfileResponse> {
  // The schema already lowercases the email. Usernames compare through their lowercase copy.
  const usernameLower = input.username.toLowerCase();

  try {
    return await profileRepository.runInTransaction(async (tx) => {
      // Username first, so it wins when both are taken (same rule as register).
      if (await tx.isUsernameTakenByOther(usernameLower, userId)) {
        throw conflictFor('username');
      }
      if (await tx.isEmailTakenByOther(input.email, userId)) {
        throw conflictFor('email');
      }

      const updated = await tx.updateProfile(userId, {
        name: input.name,
        username: input.username,
        usernameLower,
        email: input.email,
        phone: input.phone,
      });
      if (!updated) {
        throw new UnauthorizedError(NOT_LOGGED_IN);
      }
      return readOrFail(await tx.findProfile(userId));
    });
  } catch (error) {
    // Two parallel updates can both pass the pre-check. The database unique index stops the
    // second one, and it gets the same 409 the pre-check would have given.
    if (error instanceof UniqueViolationError) {
      throw conflictFor(error.field);
    }
    throw error;
  }
}

async function upsertAddress(userId: number, input: UpsertAddressInput): Promise<ProfileResponse> {
  const ids: RegionIds = {
    provinceId: input.province.id,
    cityId: input.city.id,
    districtId: input.district.id,
    subDistrictId: input.subDistrict.id,
  };

  return profileRepository.runInTransaction(async (tx) => {
    const errors = checkRegionParents(ids, await tx.findRegionParents(ids));
    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Please fix the highlighted fields.', errors);
    }

    await tx.upsertAddress(userId, { street: input.street, zipCode: input.zipCode, ...ids });
    return readOrFail(await tx.findProfile(userId));
  });
}

export const profileService = { getProfile, updateProfile, upsertAddress };
