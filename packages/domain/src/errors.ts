export class DomainError extends Error {
  constructor(
    readonly code: string,
    readonly details?: Record<string, unknown>
  ) {
    super(code);
  }
}
