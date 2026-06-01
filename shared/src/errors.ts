export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class ConnectionError extends DomainError {
  constructor(service: string, cause?: unknown) {
    super(`Failed to connect to ${service}`, "CONNECTION_ERROR", cause);
    this.name = "ConnectionError";
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource} '${id}' not found`, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class AuthenticationError extends DomainError {
  constructor(service: string) {
    super(`Authentication failed for ${service}`, "AUTH_ERROR");
    this.name = "AuthenticationError";
  }
}
