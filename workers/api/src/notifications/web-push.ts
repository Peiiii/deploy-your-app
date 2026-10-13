export const bytes = (value: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0));
export const base64url = (value: Uint8Array<ArrayBuffer>): string =>
  btoa(String.fromCharCode(...value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const concat = (...parts: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> => {
  const joined = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  return joined;
};
const utf8 = (value: string) => new TextEncoder().encode(value);
const hmac = async (key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>) =>
  new Uint8Array(
    await crypto.subtle.sign(
      'HMAC',
      await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
      data
    )
  );
/** RFC 8291 single aes128gcm record; ephemeral encryption key is separate from VAPID signing. */
export async function encryptPush(
  publicKey: string,
  auth: string,
  plaintext: string,
  ephemeral?: CryptoKeyPair,
  suppliedSalt?: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> {
  const receiver = bytes(publicKey),
    authentication = bytes(auth);
  if (receiver.length !== 65 || receiver[0] !== 4 || authentication.length !== 16)
    throw Error('Invalid push keys');
  const pair =
    ephemeral ??
    ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ])) as CryptoKeyPair);
  const sender = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const peer = await crypto.subtle.importKey(
    'raw',
    receiver,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const secret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: peer }, pair.privateKey, 256)
  );
  const prkKey = await hmac(authentication, secret);
  const ikm = await hmac(
    prkKey,
    concat(utf8('WebPush: info\0'), receiver, sender, new Uint8Array([1]))
  );
  const salt = suppliedSalt ?? crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (
    await hmac(prk, concat(utf8('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))
  ).slice(0, 16);
  const nonce = (
    await hmac(prk, concat(utf8('Content-Encoding: nonce\0'), new Uint8Array([1])))
  ).slice(0, 12);
  const content = utf8(plaintext);
  if (content.length > 3000) throw Error('Push payload too large');
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']),
      concat(content, new Uint8Array([2]))
    )
  );
  const header = concat(salt, new Uint8Array([0, 0, 16, 0, sender.length]), sender);
  return concat(header, encrypted);
}
export async function vapidAuthorization(
  endpoint: string,
  jwkText: string,
  at = Date.now()
): Promise<string> {
  const jwk = JSON.parse(jwkText) as JsonWebKey;
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const publicKey = concat(new Uint8Array([4]), bytes(jwk.x!), bytes(jwk.y!));
  const token =
    base64url(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))) +
    '.' +
    base64url(
      utf8(
        JSON.stringify({
          aud: new URL(endpoint).origin,
          exp: Math.floor(at / 1000) + 12 * 3600,
          sub: 'https://gemigo.io',
        })
      )
    );
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(token))
  );
  return 'vapid t=' + token + '.' + base64url(signature) + ', k=' + base64url(publicKey);
}
export function supportedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.port &&
      !url.username &&
      !url.password &&
      [
        'fcm.googleapis.com',
        'updates.push.services.mozilla.com',
        'push.services.mozilla.com',
        'web.push.apple.com',
      ].includes(url.hostname) &&
      value.length < 2048
    );
  } catch {
    return false;
  }
}
export async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  jwk: string,
  payload: string
): Promise<Response> {
  if (!supportedPushEndpoint(subscription.endpoint)) throw Error('Unsupported push service');
  return fetch(subscription.endpoint, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: await vapidAuthorization(subscription.endpoint, jwk),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '300',
      Urgency: 'normal',
    },
    body: await encryptPush(subscription.p256dh, subscription.auth, payload),
  });
}
