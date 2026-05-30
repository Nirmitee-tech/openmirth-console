/**
 * Typed Mirth client errors. Every consumer should match on these
 * concrete classes instead of inspecting message strings.
 */

export class MirthError extends Error {
  override readonly name: string = "MirthError"
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
  }
}

/** Mirth returned 401 / 403, or session expired and re-login failed. */
export class MirthAuthError extends MirthError {
  override readonly name = "MirthAuthError"
}

/** Network failure, DNS, TLS, or Mirth itself unreachable. */
export class MirthUnreachableError extends MirthError {
  override readonly name = "MirthUnreachableError"
}

/** Mirth responded but the payload didn't match our Zod schema. */
export class MirthSchemaError extends MirthError {
  override readonly name = "MirthSchemaError"
  constructor(
    message: string,
    public readonly issues: unknown,
    cause?: unknown
  ) {
    super(message, cause)
  }
}

/** Mirth responded 4xx/5xx that's not auth-related. */
export class MirthApiError extends MirthError {
  override readonly name = "MirthApiError"
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: string,
    cause?: unknown
  ) {
    super(message, cause)
  }
}
