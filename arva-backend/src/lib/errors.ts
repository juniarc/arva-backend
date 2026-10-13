// Typed errors thrown by services and mapped to HTTP responses in middleware/errorHandler.ts.

export type FieldErrors = Record<string, string>;

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: FieldErrors,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ConflictError extends Error {
  constructor(
    message: string,
    public readonly field: 'username' | 'email',
  ) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export type StockErrorCode = 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK' | 'PRODUCT_UNAVAILABLE';

// A stock or availability rule was broken. Mapped to 409 with a machine-readable `code`.
export class StockConflictError extends Error {
  constructor(
    public readonly code: StockErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'StockConflictError';
  }
}

// The database refused a write because a unique index would be broken.
// Repositories throw this, so services never see Prisma errors.
export class UniqueViolationError extends Error {
  constructor(public readonly field: 'username' | 'email') {
    super(`Unique violation on ${field}`);
    this.name = 'UniqueViolationError';
  }
}
