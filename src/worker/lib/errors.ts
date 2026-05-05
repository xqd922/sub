/**
 * Single error class — replaces the previous AppError + ErrorCode + ErrorFactory triad.
 *
 * Design choice: one class with a `code` string. No separate enum/severity bookkeeping;
 * the HTTP status drives observability. Factories are plain helpers below.
 */
export type ErrorCode =
  | "INVALID_INPUT"
  | "MISSING_PARAM"
  | "AUTH_REQUIRED"
  | "AUTH_FAILED"
  | "NOT_FOUND"
  | "PROVIDER_FAILED"
  | "PARSE_FAILED"
  | "FETCH_FAILED"
  | "RATE_LIMITED"
  | "INTERNAL";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  INVALID_INPUT: 400,
  MISSING_PARAM: 400,
  AUTH_REQUIRED: 401,
  AUTH_FAILED: 401,
  NOT_FOUND: 404,
  PROVIDER_FAILED: 502,
  PARSE_FAILED: 422,
  FETCH_FAILED: 502,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  override readonly cause?: unknown;
  readonly meta?: Readonly<Record<string, unknown>>;

  constructor(
    code: ErrorCode,
    message: string,
    options: { cause?: unknown; meta?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.cause = options.cause;
    this.meta = options.meta;
  }

  /** JSON shape returned to API clients. */
  toJSON(): { error: { code: ErrorCode; message: string; meta?: Record<string, unknown> } } {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.meta && { meta: this.meta }),
      },
    };
  }
}

// ── Factory helpers ─────────────────────────────────────────────
export const errors = {
  missingParam: (name: string) =>
    new AppError("MISSING_PARAM", `Missing required parameter: ${name}`),
  invalidInput: (msg: string, meta?: Record<string, unknown>) =>
    new AppError("INVALID_INPUT", msg, { meta }),
  authRequired: () => new AppError("AUTH_REQUIRED", "Authentication required"),
  authFailed: () => new AppError("AUTH_FAILED", "Invalid credentials"),
  notFound: (what: string) => new AppError("NOT_FOUND", `${what} not found`),
  providerFailed: (provider: string, cause?: unknown) =>
    new AppError("PROVIDER_FAILED", `Provider ${provider} failed`, { cause }),
  parseFailed: (msg: string, cause?: unknown) =>
    new AppError("PARSE_FAILED", msg, { cause }),
  fetchFailed: (url: string, cause?: unknown) =>
    new AppError("FETCH_FAILED", `Failed to fetch ${maskUrl(url)}`, { cause }),
  internal: (cause?: unknown) =>
    new AppError("INTERNAL", "Internal server error", { cause }),
};

/** Mask credentials and tokens in a URL before logging or returning to client. */
export function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.username || u.password) {
      u.username = "***";
      u.password = "";
    }
    for (const key of ["token", "key", "auth", "password", "secret"]) {
      if (u.searchParams.has(key)) {
        u.searchParams.set(key, "***");
      }
    }
    return u.toString();
  } catch {
    return url;
  }
}

/** Coerce any thrown value into an AppError. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof Error) {
    return new AppError("INTERNAL", err.message, { cause: err });
  }
  return new AppError("INTERNAL", String(err), { cause: err });
}
