import 'dotenv/config';
import { createHash } from 'node:crypto';
import { closeDbPool } from '../db/pool.js';
import { generateFingerprint } from '../modules/shops/fingerprint-generator.js';
import {
  listActiveShopFingerprints,
  listActiveShopsWithoutFingerprint,
  updateShopFingerprint
} from '../modules/shops/repository.js';

function fingerprintSha256Prefix(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 8);
}

async function main() {
  const shops = await listActiveShopsWithoutFingerprint();
  const updated: Array<{ shopId: number; fingerprintSha256: string }> = [];
  const existing = await listActiveShopFingerprints();
  const usedRenderers = new Set(existing.map((shop) => shop.fingerprintConfig.webglRenderer));

  for (const shop of shops) {
    let fingerprint = generateFingerprint();
    for (let retry = 0; retry < 20 && usedRenderers.has(fingerprint.webglRenderer); retry += 1) {
      fingerprint = generateFingerprint();
    }
    await updateShopFingerprint(shop.id, fingerprint);
    usedRenderers.add(fingerprint.webglRenderer);
    updated.push({
      shopId: shop.id,
      fingerprintSha256: fingerprintSha256Prefix(fingerprint)
    });
  }

  console.log(JSON.stringify({ ok: true, updated }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbPool();
  });
