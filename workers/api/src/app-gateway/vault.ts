import { ConfigurationError, ValidationError } from '../utils/error-handler';

export interface EncryptedSecret {
  ciphertext: string;
  keyVersion: string;
}
function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}
function decode(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

async function keyring(
  raw: string | undefined
): Promise<{ active: string; keys: Record<string, string> }> {
  try {
    const ring = JSON.parse(raw || '');
    if (
      !ring.active ||
      typeof ring.keys?.[ring.active] !== 'string' ||
      decode(ring.keys[ring.active]).byteLength !== 32
    )
      throw new Error();
    return ring;
  } catch {
    throw new ConfigurationError('App Secrets are not configured on the platform.');
  }
}
async function cryptoKey(raw: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', decode(raw), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
function aad(projectId: string, name: string, version: number): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(JSON.stringify([projectId, name, version]));
}

export async function encryptSecret(
  keys: string | undefined,
  projectId: string,
  name: string,
  version: number,
  value: string
): Promise<EncryptedSecret> {
  if (typeof value !== 'string' || value.length < 1 || value.length > 16384)
    throw new ValidationError('Secret must contain 1–16384 characters.');
  const ring = await keyring(keys);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad(projectId, name, version) },
    await cryptoKey(ring.keys[ring.active]),
    new TextEncoder().encode(value)
  );
  return {
    ciphertext: `${encode(iv)}.${encode(new Uint8Array(encrypted))}`,
    keyVersion: ring.active,
  };
}

export async function decryptSecret(
  keys: string | undefined,
  projectId: string,
  name: string,
  version: number,
  secret: EncryptedSecret
): Promise<string> {
  const ring = await keyring(keys);
  if (!ring.keys[secret.keyVersion])
    throw new ConfigurationError('The Secret encryption key version is unavailable.');
  try {
    const [iv, ciphertext] = secret.ciphertext.split('.');
    const value = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: decode(iv), additionalData: aad(projectId, name, version) },
      await cryptoKey(ring.keys[secret.keyVersion]),
      decode(ciphertext)
    );
    return new TextDecoder().decode(value);
  } catch {
    throw new ConfigurationError('Unable to decrypt the application Secret.');
  }
}

export async function ticketHash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return encode(new Uint8Array(digest));
}
