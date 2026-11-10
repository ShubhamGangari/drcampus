export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    public message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
