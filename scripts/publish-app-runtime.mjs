// Run with the existing R2 credentials, e.g. node --env-file=server/.env scripts/publish-app-runtime.mjs.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../server/package.json', import.meta.url));
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const assets = JSON.parse(await readFile(new URL('../workers/r2-gateway/runtime-assets.json', import.meta.url)));
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;
assert.equal(R2_BUCKET_NAME, 'gemigo-apps');
assert.ok(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY, 'existing R2 credentials required');
const client = new S3Client({ region: 'auto', endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  requestHandler: { requestTimeout: 15000, connectionTimeout: 10000 }, maxAttempts: 2 });
try {
  // Verify every source before publishing any object; never upload a changed upstream bundle.
  const files = [];
  for (const asset of Object.values(assets)) {
    const body = execFileSync('curl', ['--fail', '--location', '--compressed', '--connect-timeout', '10', '--max-time', '25', '--silent', '--show-error', asset.source], { maxBuffer: 2 * 1024 * 1024 });
    assert.equal(createHash('sha256').update(body).digest('hex'), asset.sha256, 'upstream content differs from reviewed artifact');
    files.push({ asset, body });
  }
  for (const { asset, body } of files) {
    assert.ok(asset.key.startsWith('platform/runtime/'));
    await client.send(new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: asset.key, Body: body,
      ContentType: asset.contentType, CacheControl: 'public, max-age=31536000, immutable' }));
    console.log(`Published ${asset.key}: ${body.length} bytes, SHA256 ${asset.sha256}`);
  }
} finally { client.destroy(); }
