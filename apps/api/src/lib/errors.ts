// Domain error classes — mapped to HTTP status codes by the global error handler.
// Using typed errors keeps services decoupled from Express/HTTP concerns.

/** Base application error carrying an HTTP status + machine-readable code */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** 404 — requested resource does not exist */
export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, "NOT_FOUND", message);
  }
}

/**
 * 409 — write conflicts with existing state.
 * Used for duplicate grid positions and stale optimistic-lock versions.
 */
export class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    super(409, "CONFLICT", message);
  }
}
