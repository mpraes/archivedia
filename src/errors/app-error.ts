/**
 * Stable application error codes. Wire these to clients so they can
 * branch without parsing English messages.
 */
export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOTE_NOT_FOUND: "NOTE_NOT_FOUND",
  NOTE_NOT_PROCESSABLE: "NOTE_NOT_PROCESSABLE",
  INVALID_DATE: "INVALID_DATE",
  INVALID_TIMEZONE: "INVALID_TIMEZONE",
  DATABASE_UNAVAILABLE: "DATABASE_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Field-level validation problems keyed by request field name.
 */
export type ValidationFields = Readonly<Record<string, string>>;

export interface ErrorBody {
  code: ErrorCodeValue;
  message: string;
  fields?: ValidationFields;
}

/**
 * Domain-level error. Routes convert this into a JSON response with
 * a stable code and HTTP status; everything else becomes a 500.
 */
export class AppError extends Error {
  readonly code: ErrorCodeValue;
  readonly status: number;
  readonly fields?: ValidationFields;

  constructor(
    code: ErrorCodeValue,
    message: string,
    status: number,
    fields?: ValidationFields,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }

  static validation(fields: ValidationFields, message = "Invalid request."): AppError {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, 422, fields);
  }

  static notFound(message = "The requested note was not found."): AppError {
    return new AppError(ErrorCode.NOTE_NOT_FOUND, message, 404);
  }

  static invalidDate(message = "Invalid date. Expected YYYY-MM-DD."): AppError {
    return new AppError(ErrorCode.INVALID_DATE, message, 422);
  }

  static invalidTimezone(message = "Invalid timezone."): AppError {
    return new AppError(ErrorCode.INVALID_TIMEZONE, message, 422);
  }

  static databaseUnavailable(message = "Database is unavailable."): AppError {
    return new AppError(ErrorCode.DATABASE_UNAVAILABLE, message, 503);
  }

  static notProcessable(message = "Only inbox notes can be processed."): AppError {
    return new AppError(ErrorCode.NOTE_NOT_PROCESSABLE, message, 409);
  }
}
