/** Typed application error carrying an HTTP status and a user-safe message. */
export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const Errors = {
  unauthorized: (message = "Please sign in to continue.") =>
    new AppError(401, "unauthorized", message),
  forbidden: (message = "You don't have permission to do that.") =>
    new AppError(403, "forbidden", message),
  notFound: (resource = "Resource") =>
    new AppError(404, "not_found", `${resource} was not found.`),
  badRequest: (message: string) => new AppError(400, "bad_request", message),
  conflict: (message: string) => new AppError(409, "conflict", message),
  tooManyRequests: (message = "Too many requests. Please slow down.") =>
    new AppError(429, "rate_limited", message),
  upstream: (message = "An upstream service failed. Please try again.") =>
    new AppError(502, "upstream_error", message),
  timeout: (message = "The request took too long. Please try again.") =>
    new AppError(504, "timeout", message),
  internal: (message = "Something went wrong. Please try again.") =>
    new AppError(500, "internal_error", message),
};
