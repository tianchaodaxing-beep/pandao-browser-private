import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import AdmZip from 'adm-zip';
import { getCrxZipOffset, installCrxBuffer, installZipBuffer } from '../src/modules/extensions/installer.ts';

function makeZipBuffer() {
  const zip = new AdmZip();
  zip.addFile('manifest.json', Buffer.from(JSON.stringify({ manifest_version: 3, name: 'Test Extension', version: '1.2.3' })));
  zip.addFile('background.js', Buffer.from('console.log("ok");'));
  return zip.toBuffer();
}

function makeCrxV2Buffer(zipBuffer: Buffer) {
  const key = Buffer.from('key');
  const signature = Buffer.from('signature');
  const header = Buffer.alloc(16);
  header.write('Cr24', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(key.length, 8);
  header.writeUInt32LE(signature.length, 12);
  return Buffer.concat([header, key, signature, zipBuffer]);
}

describe('extension installer', () => {
  it('calculates CRX v2 zip offset after magic, version, key and signature', () => {
    const zipBuffer = makeZipBuffer();
    const crxBuffer = makeCrxV2Buffer(zipBuffer);

    assert.equal(getCrxZipOffset(crxBuffer), 16 + 3 + 9);
  });

  it('extracts CRX payload into an unpacked extension directory', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'pandao-crx-'));
    try {
      const installed = await installCrxBuffer(makeCrxV2Buffer(makeZipBuffer()), tempDir);
      assert.equal(installed.manifest.name, 'Test Extension');
      assert.equal(installed.manifest.version, '1.2.3');
      assert.equal(JSON.parse(await readFile(path.join(installed.installedPath, 'manifest.json'), 'utf8')).name, 'Test Extension');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('extracts uploaded zip payloads', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'pandao-zip-'));
    try {
      const zipPath = path.join(tempDir, 'extension.zip');
      await writeFile(zipPath, makeZipBuffer());
      const targetDir = path.join(tempDir, 'unpacked');
      const installed = await installZipBuffer(await readFile(zipPath), targetDir);

      assert.equal(installed.installedPath, targetDir);
      assert.equal(installed.manifest.version, '1.2.3');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
