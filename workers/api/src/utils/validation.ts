import { ValidationError } from './error-handler';
import type { JsonBody } from './http';

export function validateEmail(email: unknown): string {
  if (typeof email !== 'string') {
    throw new ValidationError('email must be a string');
  }
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new ValidationError('Invalid email format');
  }
  return trimmed;
}

export function validatePassword(
  password: unknown,
  minLength = 8,
): string {
  if (typeof password !== 'string') {
    throw new ValidationError('password must be a string');
  }
  const trimmed = password.trim();
  if (trimmed.length < minLength) {
    throw new ValidationError(
      `Password must be at least ${minLength} characters long`,
    );
  }
  return trimmed;
}

export function validateRequiredString(
  value: unknown,
  fieldName: string,
): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} is required and must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError(`${fieldName} cannot be empty`);
  }
  return trimmed;
}

export function validateOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new ValidationError('Value must be a string if provided');
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function validateEmailPassword(body: JsonBody): {
  email: string;
  password: string;
} {
  return {
    email: validateEmail(body.email),
    password: validatePassword(body.password),
  };
}

export function validateOptionalArray<T>(
  value: unknown,
  itemValidator?: (item: unknown) => T,
): T[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new ValidationError('Value must be an array if provided');
  }
  if (itemValidator) {
    return value
      .map((item) => itemValidator(item))
      .filter((item): item is T => item !== undefined);
  }
  return value.filter((item): item is T => typeof item === 'string');
}

