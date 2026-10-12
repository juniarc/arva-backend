import { ConflictError, UnauthorizedError } from '../lib/errors.js';
import { comparePassword, DUMMY_PASSWORD_HASH, hashPassword } from '../lib/password.js';
import { signToken } from '../lib/token.js';
import { userRepository, type UserRecord } from '../repositories/user.repository.js';
import type { LoginInput, RegisterInput } from '../schemas/auth.schema.js';

export interface PublicUser {
  user_id: number;
  username: string;
  email: string;
}

export interface LoginResult {
  access_token: string;
  user: PublicUser;
}

// The only place a database record becomes an API user. It leaves out passwordHash on purpose.
function toPublicUser(user: UserRecord): PublicUser {
  return { user_id: user.id, username: user.username, email: user.email };
}

async function register(input: RegisterInput): Promise<PublicUser> {
  const usernameLower = input.username.toLowerCase();

  // Check username first, so it wins when both are taken.
  if (await userRepository.findByUsernameLower(usernameLower)) {
    throw new ConflictError('Username is already taken.', 'username');
  }
  if (await userRepository.findByEmail(input.email)) {
    throw new ConflictError('Email is already taken.', 'email');
  }

  const user = await userRepository.create({
    username: input.username,
    usernameLower,
    email: input.email,
    passwordHash: await hashPassword(input.password),
  });
  return toPublicUser(user);
}

async function login(input: LoginInput): Promise<LoginResult> {
  const user = await userRepository.findByUsernameLower(input.username.toLowerCase());

  // Always run one bcrypt compare, even for an unknown user, so response time
  // does not reveal which usernames exist.
  const passwordMatches = await comparePassword(
    input.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !passwordMatches) {
    throw new UnauthorizedError('Invalid username or password.');
  }

  return {
    access_token: signToken({ id: user.id, username: user.username }),
    user: toPublicUser(user),
  };
}

async function getCurrentUser(userId: number): Promise<PublicUser> {
  const user = await userRepository.findById(userId);
  if (!user) {
    // A valid token for a user that no longer exists.
    throw new UnauthorizedError('Please log in.');
  }
  return toPublicUser(user);
}

export const authService = { register, login, getCurrentUser };
