import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { closeDbPool } from '../db/pool.js';
import { upsertBossUser } from '../modules/auth/repository.js';

const BCRYPT_COST = 12;
const passwordPolicy = /^(?=.*[A-Za-z])(?=.*\d).{12,}$/;

async function main() {
  const password = process.env.BOSS_PASSWORD;

  if (!password) {
    throw new Error(
      '缺少 BOSS_PASSWORD 环境变量。示例：$env:BOSS_PASSWORD = 「至少12位且包含字母和数字的密码」; npm run seed:admin -w server'
    );
  }

  if (!passwordPolicy.test(password)) {
    throw new Error('BOSS_PASSWORD 不符合策略：至少 12 位，且必须同时包含字母和数字。');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user = await upsertBossUser(passwordHash);

  console.log(
    JSON.stringify(
      {
        ok: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          displayName: user.displayName
        }
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbPool();
  });
