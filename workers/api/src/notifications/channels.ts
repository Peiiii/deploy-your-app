import { ValidationError } from '../utils/error-handler';
import { supportedPushEndpoint, bytes } from './web-push';
export async function hashEndpoint(value: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
}
export async function registerPush(
  db: D1Database,
  userId: string,
  input: Record<string, unknown>,
  remove = false
) {
  if (typeof input.endpoint !== 'string' || !supportedPushEndpoint(input.endpoint))
    throw new ValidationError('Unsupported push endpoint');
  const endpointHash = await hashEndpoint(input.endpoint);
  if (remove) {
    await db
      .prepare('DELETE FROM notification_push_subscriptions WHERE endpoint_hash=? AND user_id=?')
      .bind(endpointHash, userId)
      .run();
    return;
  }
  const keys = input.keys as { p256dh?: unknown; auth?: unknown } | undefined;
  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string')
    throw new ValidationError('Invalid push keys');
  try {
    if (bytes(keys.p256dh).length !== 65 || bytes(keys.auth).length !== 16) throw Error();
    await crypto.subtle.importKey(
      'raw',
      bytes(keys.p256dh),
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );
  } catch {
    throw new ValidationError('Invalid push keys');
  }
  const prior = await db
    .prepare('SELECT user_id FROM notification_push_subscriptions WHERE endpoint_hash=?')
    .bind(endpointHash)
    .first<{ user_id: string }>();
  if (prior && prior.user_id !== userId)
    throw new ValidationError(
      'This device is linked to a different account. Unlink it there first.'
    );
  await db
    .prepare(
      'INSERT INTO notification_push_subscriptions(endpoint_hash,user_id,endpoint,p256dh,auth,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(endpoint_hash) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth WHERE user_id=excluded.user_id'
    )
    .bind(endpointHash, userId, input.endpoint, keys.p256dh, keys.auth, Date.now())
    .run();
}
