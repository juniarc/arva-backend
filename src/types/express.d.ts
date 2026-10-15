import type { TokenUser } from '../lib/token.js';

declare global {
  // Express declares its request type in this namespace, so this is the supported way to extend it.
  namespace Express {
    interface Request {
      user?: TokenUser;
    }
  }
}
