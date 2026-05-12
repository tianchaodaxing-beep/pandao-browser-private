import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const keyPath = 'C:\\Users\\tianc\\.pandao-key\\master.key';

function fingerprint(key: Buffer) {
  return createHash('sha256').update(key).digest('hex').slice(0, 8);
}

async function main() {
  // 决策 19:master.key 已存在则报错退出 1,不覆盖。
  // 主控 Claude Opus 4.7 二次验收返修(2026-05-12 上海):
  // 把之前 codex 的 exit 0 + sha256 指纹改为严格 exit 1 + 中文报错,
  // 防止自动化脚本误以为是首次创建。
  try {
    const stat = await fs.stat(keyPath);
    throw new Error(
      `master.key 已存在,不覆盖。路径:${keyPath}(${stat.size} 字节)。若确实需要重新生成,请先人工备份后删除该文件再跑本命令。`
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
    // ENOENT:文件不存在,继续走生成流程。
  }

  await fs.mkdir(path.dirname(keyPath), { recursive: true });
  const masterKey = randomBytes(32);
  const newFingerprint = fingerprint(masterKey);
  await fs.writeFile(keyPath, masterKey, { mode: 0o600 });
  masterKey.fill(0);

  try {
    await fs.chmod(keyPath, 0o600);
  } catch {
    // Windows may ignore chmod; key length and path are the security-critical checks here.
  }

  const stat = await fs.stat(keyPath);
  console.log(JSON.stringify({ ok: true, existing: false, path: keyPath, sizeBytes: stat.size, sha256: newFingerprint }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
