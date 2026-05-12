import { randomBytes } from 'node:crypto';
import { setMasterKey } from '../modules/keystore/state.js';
import { decryptPassword, encryptPassword } from '../utils/crypto.js';

const plain = 'abc中文123';
const rounds = 5;

setMasterKey(randomBytes(32));

for (let index = 0; index < rounds; index += 1) {
  const encrypted = encryptPassword(plain);
  const decrypted = decryptPassword(encrypted);

  if (decrypted !== plain) {
    throw new Error(`AES roundtrip failed at round ${index + 1}`);
  }
}

console.log(JSON.stringify({ ok: true, rounds, plainMatched: true }, null, 2));
