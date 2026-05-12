import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { getMasterKey } from '../modules/keystore/state.js';

export type EncryptedSecretParts = {
  encrypted: Buffer;
  iv: Buffer;
  tag: Buffer;
};

export function encryptPassword(plain: string): EncryptedSecretParts {
  const masterKey = requireMasterKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', masterKey, iv, {
    authTagLength: 16
  });
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  masterKey.fill(0);
  return { encrypted, iv, tag };
}

export function decryptPassword(parts: EncryptedSecretParts): string {
  const masterKey = requireMasterKey();
  const decipher = createDecipheriv('aes-256-gcm', masterKey, parts.iv, {
    authTagLength: 16
  });
  decipher.setAuthTag(parts.tag);
  const plain = Buffer.concat([decipher.update(parts.encrypted), decipher.final()]).toString('utf8');

  masterKey.fill(0);
  return plain;
}

function requireMasterKey() {
  const masterKey = getMasterKey();
  if (!masterKey) {
    throw new Error('主密钥未注入');
  }
  return masterKey;
}
