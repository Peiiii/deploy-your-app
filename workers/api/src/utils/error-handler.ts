import { jsonResponse } from './http';

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, 500, 'CONFIGURATION_ERROR');
    this.name = 'ConfigurationError';
  }
}

export function handleError(error: unknown): Response {
  if (error instanceof AppError) {
    console.error(`[${error.name}] ${error.message}`, {
      statusCode: error.statusCode,
      code: error.code,
    });
    return jsonResponse(
      {
        error: error.message,
        code: error.code,
      },
      error.statusCode,
    );
  }

  if (error instanceof Error) {
    console.error('Unexpected error:', error);
    return jsonResponse(
      {
        error: 'Internal Server Error',
        code: 'INTERNAL_ERROR',
        // Expose message/stack for easier debugging during early-stage
        // development. If needed later, we can gate this behind an env flag.
        message: error.message,
        stack: error.stack,
      },
      500,
    );
  }

  console.error('Unknown error:', error);
  return jsonResponse(
    {
      error: 'Internal Server Error',
      code: 'UNKNOWN_ERROR',
    },
    500,
  );
}

export function tryCatch<T>(
  fn: () => Promise<T>,
  errorHandler?: (error: unknown) => Response,
): Promise<T | Response> {
  return fn().catch((error) => {
    if (errorHandler) {
      return errorHandler(error);
    }
    return handleError(error);
  });
}
