/**
 * Network Utilities
 */

export const normalizeHeaders = (headers: Record<string, string> | undefined): Record<string, string> => {
  if (!headers) return {};
  const normalized: Record<string, string> = {};
  Object.entries(headers).forEach(([key, value]) => {
    if (typeof key === 'string' && typeof value === 'string') {
      normalized[key] = value;
    }
  });
  return normalized;
};

export const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const parseBody = (
  body: unknown,
  headers: Record<string, string>
): { body?: BodyInit; headers: Record<string, string> } => {
  if (body === undefined || body === null) return { headers };

  if (typeof body === 'string') {
    return { body, headers };
  }

  if (typeof body === 'object') {
    const contentTypeKey = Object.keys(headers).find((k) => k.toLowerCase() === 'content-type') ?? null;
    if (!contentTypeKey) {
      headers['content-type'] = 'application/json';
    }
    return { body: JSON.stringify(body), headers };
  }

  return { body: String(body), headers };
};
