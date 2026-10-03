import { getSessionIdFromRequest } from '../utils/auth';
import { authRepository } from '../repositories/auth.repository';
import type { ApiWorkerEnv } from '../types/env';

export interface FeedIdentity {
  subject: string;
  account: string | null;
  expires: number;
  persistent: boolean;
}

async function signingKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}
function bytes(value: string) {
  return Uint8Array.from(atob(value), (ch) => ch.charCodeAt(0));
}
export async function signIdentity(identity: FeedIdentity, secret: string): Promise<string> {
  const payload = btoa(JSON.stringify(identity));
  const signature = await crypto.subtle.sign(
    'HMAC',
    await signingKey(secret),
    new TextEncoder().encode(payload)
  );
  return `${payload}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
}
export async function resolveIdentity(
  request: Request,
  env: ApiWorkerEnv,
  token: unknown,
  persistent: boolean
) {
  const session = getSessionIdFromRequest(request);
  const user = session ? await authRepository.getSessionWithUser(env.PROJECTS_DB, session) : null;
  const account = user?.user.id || null;
  let identity: FeedIdentity | null = null;
  if (typeof token === 'string' && token.length < 2048) {
    try {
      const [payload, signature, ...rest] = token.split('.');
      if (rest.length || !signature) throw new Error('bad_token');
      if (
        await crypto.subtle.verify(
          'HMAC',
          await signingKey(env.RECOMMENDATION_SECRET),
          bytes(signature),
          new TextEncoder().encode(payload)
        )
      ) {
        const parsed = JSON.parse(atob(payload)) as FeedIdentity;
        if (
          typeof parsed.subject === 'string' &&
          parsed.subject.length < 100 &&
          parsed.account === account &&
          parsed.expires > Date.now() &&
          parsed.persistent === persistent
        )
          identity = parsed;
      }
    } catch {
      /* Untrusted/expired tokens get a new identity, never arbitrary profile access. */
    }
  }
  if (!identity)
    identity = {
      subject: account && persistent ? `user:${account}` : `anon:${crypto.randomUUID()}`,
      account,
      expires: Date.now() + (persistent ? 35 * 86400000 : 86400000),
      persistent,
    };
  return { identity, token: await signIdentity(identity, env.RECOMMENDATION_SECRET) };
}

/** Stateless DNT pagination, separated cryptographically from identity tokens. */
export async function sealSnapshot(value: unknown, secret: string): Promise<string> {
  const payload = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))));
  const signature = await crypto.subtle.sign(
    'HMAC',
    await signingKey(secret),
    new TextEncoder().encode('batch:' + payload)
  );
  return payload + '.' + btoa(String.fromCharCode(...new Uint8Array(signature)));
}
export async function openSnapshot(value: string, secret: string): Promise<unknown> {
  const [payload, signature, ...rest] = value.split('.');
  if (
    rest.length ||
    !signature ||
    !(await crypto.subtle.verify(
      'HMAC',
      await signingKey(secret),
      bytes(signature),
      new TextEncoder().encode('batch:' + payload)
    ))
  )
    throw new Error('Invalid snapshot');
  return JSON.parse(new TextDecoder().decode(bytes(payload)));
}
