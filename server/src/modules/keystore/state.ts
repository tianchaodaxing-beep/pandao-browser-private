let masterKey: Buffer | null = null;

export function getMasterKey(): Buffer | null {
  return masterKey ? Buffer.from(masterKey) : null;
}

export function setMasterKey(nextMasterKey: Buffer) {
  if (nextMasterKey.length !== 32) {
    throw new Error('master.key 必须正好 32 字节');
  }

  masterKey?.fill(0);
  masterKey = Buffer.from(nextMasterKey);
}

export function clearMasterKey() {
  masterKey?.fill(0);
  masterKey = null;
}

export function isKeystoreUnlocked() {
  return masterKey !== null;
}
