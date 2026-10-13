import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, UnauthorizedError, UniqueViolationError, ValidationError } from '../../src/lib/errors.js';
import type { ProfileRecord } from '../../src/repositories/profile.repository.js';

const { fakeTx, fakeRepository } = vi.hoisted(() => {
  const fakeTx = {
    isUsernameTakenByOther: vi.fn(),
    isEmailTakenByOther: vi.fn(),
    updateProfile: vi.fn(),
    findRegionParents: vi.fn(),
    upsertAddress: vi.fn(),
    findProfile: vi.fn(),
  };
  const fakeRepository = {
    runInTransaction: vi.fn(async (work: (tx: typeof fakeTx) => Promise<unknown>) => work(fakeTx)),
    findProfile: vi.fn(),
  };
  return { fakeTx, fakeRepository };
});

vi.mock('../../src/repositories/profile.repository.js', () => ({ profileRepository: fakeRepository }));

const { profileService, toProfileResponse } = await import('../../src/services/profile.service.js');

const USER = 1;

function record(overrides: Partial<ProfileRecord> = {}): ProfileRecord {
  return {
    username: 'Alice_01',
    name: 'Alice',
    email: 'alice@example.com',
    phone: null,
    photoUrl: null,
    address: null,
    ...overrides,
  };
}

const input = { name: 'Alice', username: 'Alice_01', email: 'alice@example.com', phone: null };

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('Expected the promise to reject.');
    },
    (error: unknown) => error,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fakeRepository.runInTransaction.mockImplementation(async (work) => work(fakeTx));
  fakeTx.isUsernameTakenByOther.mockResolvedValue(false);
  fakeTx.isEmailTakenByOther.mockResolvedValue(false);
  fakeTx.updateProfile.mockResolvedValue(true);
  fakeTx.findProfile.mockResolvedValue(record());
});

describe('toProfileResponse', () => {
  it('returns address null when the user has no saved address', () => {
    expect(toProfileResponse(record()).address).toBeNull();
  });

  it('maps a saved address with string region ids', () => {
    const response = toProfileResponse(
      record({
        address: {
          street: 'Jl. Mawar 1',
          zipCode: '12345',
          subDistrict: { id: '3171071001', name: 'Gelora' },
          district: { id: '317107', name: 'Tanah Abang' },
          city: { id: '3171', name: 'Kota Administrasi Jakarta Pusat' },
          province: { id: '31', name: 'DKI Jakarta' },
        },
      }),
    );

    expect(response.address).toEqual({
      street: 'Jl. Mawar 1',
      zipCode: '12345',
      subDistrict: { id: '3171071001', name: 'Gelora' },
      district: { id: '317107', name: 'Tanah Abang' },
      city: { id: '3171', name: 'Kota Administrasi Jakarta Pusat' },
      province: { id: '31', name: 'DKI Jakarta' },
    });
  });

  it('has only the documented user fields', () => {
    expect(Object.keys(toProfileResponse(record()).user).sort()).toEqual([
      'email',
      'name',
      'phone',
      'photoUrl',
      'username',
    ]);
  });
});

describe('profileService.getProfile', () => {
  it('rejects a token for a user that no longer exists', async () => {
    fakeRepository.findProfile.mockResolvedValue(null);

    await expect(profileService.getProfile(USER)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe('profileService.updateProfile', () => {
  it('checks the username through its lowercase copy and the email as given (already lowercase)', async () => {
    await profileService.updateProfile(USER, { ...input, username: 'Alice_01', email: 'alice@example.com' });

    expect(fakeTx.isUsernameTakenByOther).toHaveBeenCalledWith('alice_01', USER);
    expect(fakeTx.isEmailTakenByOther).toHaveBeenCalledWith('alice@example.com', USER);
    expect(fakeTx.updateProfile).toHaveBeenCalledWith(USER, {
      name: 'Alice',
      username: 'Alice_01',
      usernameLower: 'alice_01',
      email: 'alice@example.com',
      phone: null,
    });
  });

  it('returns 409 for a taken username', async () => {
    fakeTx.isUsernameTakenByOther.mockResolvedValue(true);

    const error = await rejection(profileService.updateProfile(USER, input));

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).field).toBe('username');
    expect((error as ConflictError).message).toBe('This username is already taken.');
    expect(fakeTx.updateProfile).not.toHaveBeenCalled();
  });

  it('returns 409 for a taken email', async () => {
    fakeTx.isEmailTakenByOther.mockResolvedValue(true);

    const error = await rejection(profileService.updateProfile(USER, input));

    expect((error as ConflictError).field).toBe('email');
    expect((error as ConflictError).message).toBe('This email is already used.');
  });

  it('reports the username when both are taken', async () => {
    fakeTx.isUsernameTakenByOther.mockResolvedValue(true);
    fakeTx.isEmailTakenByOther.mockResolvedValue(true);

    const error = await rejection(profileService.updateProfile(USER, input));

    expect((error as ConflictError).field).toBe('username');
  });

  it.each(['username', 'email'] as const)(
    'maps a database unique violation on %s to the matching 409',
    async (field) => {
      // Both pre-checks pass, but the database index stops the write (a parallel update won).
      fakeTx.updateProfile.mockRejectedValue(new UniqueViolationError(field));

      const error = await rejection(profileService.updateProfile(USER, input));

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).field).toBe(field);
    },
  );

  it('passes other errors through', async () => {
    fakeTx.updateProfile.mockRejectedValue(new Error('boom'));

    await expect(profileService.updateProfile(USER, input)).rejects.toThrow('boom');
  });

  it('rejects when the user no longer exists', async () => {
    fakeTx.updateProfile.mockResolvedValue(false);

    await expect(profileService.updateProfile(USER, input)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe('profileService.upsertAddress', () => {
  const address = {
    street: 'Jl. Mawar 1',
    subDistrict: { id: '3171071001' },
    district: { id: '317107' },
    city: { id: '3171' },
    province: { id: '31' },
    zipCode: '12345',
  };
  const consistent = {
    province: { id: '31' },
    city: { provinceId: '31' },
    district: { cityId: '3171' },
    subDistrict: { districtId: '317107' },
  };

  it('saves the address after the region chain checks out', async () => {
    fakeTx.findRegionParents.mockResolvedValue(consistent);

    await profileService.upsertAddress(USER, address);

    expect(fakeTx.upsertAddress).toHaveBeenCalledWith(USER, {
      street: 'Jl. Mawar 1',
      zipCode: '12345',
      provinceId: '31',
      cityId: '3171',
      districtId: '317107',
      subDistrictId: '3171071001',
    });
  });

  it('rejects a city from another province with errors.city and saves nothing', async () => {
    fakeTx.findRegionParents.mockResolvedValue({ ...consistent, city: { provinceId: '32' } });

    const error = await rejection(profileService.upsertAddress(USER, address));

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toEqual({ city: 'This city is not in the selected province.' });
    expect(fakeTx.upsertAddress).not.toHaveBeenCalled();
  });

  it('rejects an unknown region id with a field error (400, not 404)', async () => {
    fakeTx.findRegionParents.mockResolvedValue({ ...consistent, province: null });

    const error = await rejection(profileService.upsertAddress(USER, address));

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toHaveProperty('province');
  });
});
