import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createECDH, hkdfSync, createDecipheriv } from 'node:crypto';
import { ensureNotificationSchema } from '../packages/notifications/src/persistence';
import {
  encryptPush,
  bytes,
  base64url,
  vapidAuthorization,
  supportedPushEndpoint,
} from '../workers/api/src/notifications/web-push';
import { defaultPreferences } from '../packages/notifications/src/contract';
import { quiet, localTime, nextAllowed } from '../workers/api/src/notifications/policy';
import { reserveDelivery } from '../workers/api/src/notifications/delivery';
// RFC 8291 published test vector. Fixed ephemeral key/salt only in this test.
const receiverPublic =
  'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4';
const senderPublic =
  'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8';
const point = bytes(senderPublic);
const privateKey = await crypto.subtle.importKey(
  'jwk',
  {
    kty: 'EC',
    crv: 'P-256',
    d: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
    x: base64url(point.slice(1, 33)),
    y: base64url(point.slice(33)),
  },
  { name: 'ECDH', namedCurve: 'P-256' },
  true,
  ['deriveBits']
);
const publicKey = await crypto.subtle.importKey(
  'raw',
  point,
  { name: 'ECDH', namedCurve: 'P-256' },
  true,
  []
);
const auth = bytes('BTBZMqHH6r4Tts7J_aSIgg');
const salt = bytes('DGv6ra1nlYgDCS1FRnbzlw');
const payload = 'When I grow up, I want to be a watermelon';
const encrypted = await encryptPush(
  receiverPublic,
  base64url(auth),
  payload,
  { privateKey, publicKey },
  salt
);
const expected =
  'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN';
assert.equal(base64url(encrypted), expected, 'RFC encrypted record matches byte for byte');
const ecdh = createECDH('prime256v1');
ecdh.setPrivateKey(Buffer.from(bytes('q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94')));
const secret = ecdh.computeSecret(Buffer.from(point));
const ikm = hkdfSync(
  'sha256',
  secret,
  auth,
  Buffer.concat([
    Buffer.from('WebPush: info\0'),
    Buffer.from(bytes(receiverPublic)),
    Buffer.from(point),
  ]),
  32
);
const cek = hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
const nonce = hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
const decipher = createDecipheriv('aes-128-gcm', Buffer.from(cek), Buffer.from(nonce));
const ciphertext = Buffer.from(encrypted.slice(86));
decipher.setAuthTag(ciphertext.subarray(-16));
const decoded = Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()]);
assert.equal(decoded.subarray(0, -1).toString(), payload);
assert.equal(decoded.at(-1), 2);
const vapid = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
]);
const jwk = await crypto.subtle.exportKey('jwk', vapid.privateKey);
const authorization = await vapidAuthorization(
  'https://fcm.googleapis.com/fcm/send/fixture',
  JSON.stringify(jwk)
);
const token = authorization.split('t=')[1].split(',')[0];
const [header, body, signature] = token.split('.');
assert.equal(JSON.parse(new TextDecoder().decode(bytes(body))).aud, 'https://fcm.googleapis.com');
assert.ok(
  await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    vapid.publicKey,
    bytes(signature),
    new TextEncoder().encode(header + '.' + body)
  )
);
assert.equal(supportedPushEndpoint('http://fcm.googleapis.com/a'), false);
assert.equal(supportedPushEndpoint('https://127.0.0.1/a'), false);
assert.equal(supportedPushEndpoint('https://fcm.googleapis.com.evil.invalid/a'), false);
const prefs = defaultPreferences();
prefs.timezone = 'Asia/Shanghai';
assert.equal(quiet(Date.parse('2026-10-13T15:00:00Z'), prefs), true);
assert.equal(quiet(Date.parse('2026-10-14T01:00:00Z'), prefs), false);
assert.equal(localTime(Date.parse('2026-10-13T16:00:00Z'), prefs.timezone)?.day, '2026-10-14');
assert.equal(
  nextAllowed(Date.parse('2026-10-13T15:00:00Z'), prefs),
  Date.parse('2026-10-14T00:00:00Z')
);
assert.equal(nextAllowed(Date.now(), { ...prefs, timezone: '' }), null);
assert.equal(nextAllowed(Date.now(), { ...prefs, quietEnd: prefs.quietStart }), null);
prefs.timezone = 'America/New_York';
assert.equal(quiet(Date.parse('2026-11-01T06:30:00Z'), prefs), true, 'DST fallback still quiet');
const require = createRequire(import.meta.url);
const runtime = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare } = runtime('miniflare');
const mf = new Miniflare({
  modules: true,
  script: 'export default {fetch(){return new Response("ok")}}',
  d1Databases: { DB: 'notification-budget-test' },
});
try {
  const db = (await mf.getD1Database('DB')) as D1Database;
  await ensureNotificationSchema(db);
  const now = Date.now();
  const insert = async (id: string, at = now, category = 'direct') =>
    db
      .prepare(
        "INSERT INTO notification_deliveries(id,recipient_id,channel,scope,payload,state,not_before,expires_at) VALUES(?,'reader','push',?,?,'pending',?,?)"
      )
      .bind(id, id, JSON.stringify({ category }), at, at + 86400000)
      .run();
  await insert('one');
  await insert('two');
  const results = await Promise.all([
    reserveDelivery(db, 'one', now),
    reserveDelivery(db, 'two', now),
  ]);
  assert.equal(results.filter(Boolean).length, 1, 'concurrent claims share cooldown/slot');
  await db
    .prepare(
      "UPDATE notification_deliveries SET state='accepted',first_attempt_at=? WHERE id='one'"
    )
    .bind(now - 2 * 3600000)
    .run();
  assert.equal(await reserveDelivery(db, 'two', now), true);
  await db
    .prepare(
      "UPDATE notification_deliveries SET state='accepted',first_attempt_at=? WHERE id='two'"
    )
    .bind(now - 90 * 60000)
    .run();
  await insert('three');
  assert.equal(await reserveDelivery(db, 'three', now), true);
  await db
    .prepare(
      "UPDATE notification_deliveries SET state='accepted',first_attempt_at=? WHERE id='three'"
    )
    .bind(now - 70 * 60000)
    .run();
  await insert('four');
  assert.equal(await reserveDelivery(db, 'four', now), false, 'rolling 24-hour cap');
  await db
    .prepare("UPDATE notification_deliveries SET state='failed' WHERE id IN ('one','two','three')")
    .run();
  await insert('digest-a', now, 'digest');
  assert.equal(await reserveDelivery(db, 'digest-a', now), true);
  await db
    .prepare(
      "UPDATE notification_deliveries SET state='accepted',first_attempt_at=? WHERE id='digest-a'"
    )
    .bind(now - 2 * 3600000)
    .run();
  await insert('digest-b', now, 'digest');
  assert.equal(
    await reserveDelivery(db, 'digest-b', now),
    false,
    'timezone changes cannot create a second digest slot'
  );
  console.log(
    'PASS: RFC ciphertext and independent decryption, VAPID signature, endpoint allowlist, quiet/DST/unknown timezone, atomic cooldown/cap/digest budget'
  );
} finally {
  await mf.dispose();
}
