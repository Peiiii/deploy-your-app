import { AppError } from './error-handler';

export function validateProjectAddress(value: string): string {
  if (value.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value)) {
    throw new AppError('Use 1–63 lowercase letters, numbers or hyphens; start and end with a letter or number.', 400, 'INVALID_ADDRESS');
  }
  return value;
}

export function addressTakenError(): AppError {
  return new AppError('This address is already in use. Choose another address.', 409, 'ADDRESS_TAKEN');
}

export function addressLockedError(): AppError {
  return new AppError('The address cannot be changed after publication has started.', 400, 'ADDRESS_LOCKED');
}
