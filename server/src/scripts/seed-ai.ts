import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { closeDbPool } from '../db/pool.js';
import { upsertAiUser } from '../modules/auth/repository.js';

const BCRYPT_COST = 12;
const passwordPolicy = /^.{12,}$/;

async function main() {
  const password = process.env.AI_PASSWORD;

  if (!password) {
    throw new Error('Missing AI_PASSWORD. Example: $env:AI_PASSWORD="at-least-12-chars"; npm run seed:ai -w server');
  }

  if (!passwordPolicy.test(password)) {
    throw new Error('AI_PASSWORD must be at least 12 characters.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user = await upsertAiUser(passwordHash);

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
