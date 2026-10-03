import { ValidationError } from '../utils/error-handler';

export type ConnectionProtocol = 'openai-chat' | 'qwen-realtime' | 'http';
export interface ConnectionConfig {
  name: string;
  protocol: ConnectionProtocol;
  baseUrl: string;
  secretName: string;
  authHeader: string;
  authPrefix: string;
  access: 'login' | 'public';
  enabled: boolean;
  models: string[];
  method: 'GET' | 'POST';
  path: string;
  limits: {
    userDaily: number;
    appDaily: number;
    concurrency: number;
    userConcurrency: number;
    durationSeconds: number;
    outputTokens: number;
  };
}

export function connectionName(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value))
    throw new ValidationError('Use a name of 1–64 letters, digits, underscores or dashes.');
  return value;
}

export function publicAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (ip.includes(':')) {
    // Accept only global unicast. Reject mapped IPv4, transition/tunnel and documentation ranges.
    return /^[23][0-9a-f]{3}:/.test(ip) && !/^(2001:(db8|0|10|20):|2002:)/.test(ip);
  }
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((v) => !Number.isInteger(v) || v < 0 || v > 255))
    return false;
  const [a, b, c] = parts;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99) || (b === 0 && c === 2))) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}

export function upstreamUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 1024)
    throw new ValidationError('Enter a public HTTPS API URL.');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ValidationError('Invalid API URL.');
  }
  const host = url.hostname.toLowerCase();
  if (
    !['https:', 'wss:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    (url.port && url.port !== '443') ||
    host.includes(':') ||
    /^[\d.]+$/.test(host) ||
    !host.includes('.') ||
    /\.(local|localhost|internal|lan|home|test|invalid)$/.test(host) ||
    host === 'localhost' ||
    host === 'metadata.google.internal'
  )
    throw new ValidationError('Only public HTTPS/WSS hostnames on port 443 are supported.');
  url.protocol = 'https:';
  return url.href.replace(/\/+$/, '');
}

function bounded(raw: unknown, fallback: number, maximum: number): number {
  if (raw === undefined) return fallback;
  if (!Number.isInteger(raw) || Number(raw) < 1 || Number(raw) > maximum)
    throw new ValidationError(`Limits must be whole numbers between 1 and ${maximum}.`);
  return Number(raw);
}

export function parseConnection(name: string, input: unknown): ConnectionConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new ValidationError('Invalid connection configuration.');
  const v = input as Partial<ConnectionConfig>;
  if (!['openai-chat', 'qwen-realtime', 'http'].includes(v.protocol))
    throw new ValidationError('Unsupported protocol.');
  if (v.access !== 'login' && v.access !== 'public')
    throw new ValidationError('Select login or public access.');
  if (typeof v.enabled !== 'boolean')
    throw new ValidationError('Select whether the connection is enabled.');
  const authHeader = (v.authHeader || 'Authorization').toLowerCase();
  if (
    !/^[a-z][a-z0-9-]{0,63}$/.test(authHeader) ||
    [
      'host',
      'cookie',
      'connection',
      'content-length',
      'upgrade',
      'origin',
      'accept',
      'content-type',
      'transfer-encoding',
    ].includes(authHeader) ||
    authHeader.startsWith('sec-')
  )
    throw new ValidationError('Invalid authentication header.');
  const authPrefix = v.authPrefix ?? 'Bearer ';
  if (typeof authPrefix !== 'string' || authPrefix.length > 64 || /[\r\n]/.test(authPrefix))
    throw new ValidationError('Invalid authentication prefix.');
  const models = Array.isArray(v.models) ? [...new Set(v.models)] : [];
  if (
    models.length > 20 ||
    models.some((m) => typeof m !== 'string' || !/^[\w./:-]{1,128}$/.test(m)) ||
    (v.protocol !== 'http' && !models.length)
  )
    throw new ValidationError('Specify 1–20 permitted model IDs.');
  const path = v.path || '/';
  if (typeof path !== 'string' || !/^\/[A-Za-z0-9/_-]*$/.test(path) || path.includes('//'))
    throw new ValidationError('HTTP path must be a fixed path, without query parameters.');
  const limits = v.limits || ({} as ConnectionConfig['limits']);
  return {
    name: connectionName(name),
    protocol: v.protocol,
    baseUrl: upstreamUrl(v.baseUrl),
    secretName: connectionName(v.secretName),
    authHeader,
    authPrefix,
    access: v.access,
    enabled: v.enabled,
    models,
    method: v.method === 'GET' ? 'GET' : 'POST',
    path,
    limits: {
      userDaily: bounded(limits.userDaily, 20, 10000),
      appDaily: bounded(limits.appDaily, 200, 100000),
      concurrency: bounded(limits.concurrency, 4, 10),
      userConcurrency: bounded(limits.userConcurrency, 1, 4),
      durationSeconds: bounded(
        limits.durationSeconds,
        v.protocol === 'qwen-realtime' ? 300 : 60,
        v.protocol === 'qwen-realtime' ? 600 : 120
      ),
      outputTokens: bounded(limits.outputTokens, 1024, 8192),
    },
  };
}

export async function checkPublicDns(target: string): Promise<void> {
  const hostname = new URL(target).hostname;
  const results = await Promise.all(
    [1, 28].map(async (type) => {
      let response: Response;
      try {
        response = await fetch(
          `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`,
          { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(5000) }
        );
      } catch (error) {
        console.warn(
          'Gateway DNS validation failed:',
          error instanceof Error ? error.name : 'network error'
        );
        throw new ValidationError(
          'Unable to validate upstream DNS. Retry when the network is available.'
        );
      }
      if (!response.ok) throw new ValidationError('Unable to validate the upstream hostname.');
      return (await response.json()) as {
        Status: number;
        Answer?: { type: number; data: string }[];
      };
    })
  );
  const addresses = results.flatMap((r) =>
    (r.Answer || []).filter((a) => a.type === 1 || a.type === 28).map((a) => a.data)
  );
  if (!addresses.length || addresses.some((a) => !publicAddress(a)))
    throw new ValidationError('Upstream DNS must resolve exclusively to public addresses.');
}
