import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import type { LoginRequest, RefreshRequest, RefreshResponse } from 'shared';
import { authenticateRequest } from './guards.js';
import {
  findUserById,
  findUserByRefreshJti,
  findUserByUsername,
  revokeRefreshToken,
  storeRefreshToken,
  updateLastLogin
} from './repository.js';
import {
  createRefreshJti,
  getRefreshExpiry,
  signAccessToken,
  signRefreshToken
} from './token.js';
import type { AuthUser, RefreshJwtPayload, UserRecord } from './types.js';

type LogoutBody = {
  refreshToken?: string;
};

function toPublicUser(record: UserRecord): AuthUser {
  const { passwordHash, frozenUntil, ...publicUser } = record;
  return publicUser;
}

function sanitizeUsername(username: unknown) {
  return typeof username === 'string' ? username.trim() : '';
}

function sanitizePassword(password: unknown) {
  return typeof password === 'string' ? password : '';
}

async function buildTokenPair(app: FastifyInstance, user: AuthUser): Promise<RefreshResponse> {
  const jti = createRefreshJti();
  await storeRefreshToken(user.id, jti, getRefreshExpiry());

  return {
    token: signAccessToken(app, user),
    refreshToken: signRefreshToken(app, user, jti)
  };
}

async function verifyRefreshToken(app: FastifyInstance, refreshToken: string) {
  try {
    const payload = await app.jwt.verify<RefreshJwtPayload>(refreshToken, {
      key: app.jwtSecrets.refreshSecret,
      algorithms: ['HS256']
    });

    if (payload.type !== 'refresh' || !payload.jti) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: Partial<LoginRequest> }>('/login', async (request, reply) => {
    const username = sanitizeUsername(request.body?.username);
    const password = sanitizePassword(request.body?.password);

    if (!username || !password) {
      reply.code(400).send({ error: 'INVALID_INPUT', message: '用户名和密码不能为空' });
      return;
    }

    const userRecord = await findUserByUsername(username);
    const validPassword = userRecord ? await bcrypt.compare(password, userRecord.passwordHash) : false;

    if (!userRecord || !validPassword) {
      reply.code(401).send({ error: 'INVALID_CREDENTIALS', message: '用户名或密码错误' });
      return;
    }

    if (userRecord.status === 'frozen' && userRecord.frozenUntil && userRecord.frozenUntil > new Date()) {
      reply.code(423).send({ error: 'USER_FROZEN', message: '账号暂时冻结' });
      return;
    }

    if (userRecord.status !== 'active') {
      reply.code(403).send({ error: 'USER_DISABLED', message: '账号不可用' });
      return;
    }

    await updateLastLogin(userRecord.id);
    const tokenPair = await buildTokenPair(app, userRecord);

    return {
      ...tokenPair,
      user: toPublicUser(userRecord)
    };
  });

  app.post<{ Body: Partial<RefreshRequest> }>('/refresh', async (request, reply): Promise<RefreshResponse | void> => {
    const refreshToken = request.body?.refreshToken;

    if (!refreshToken) {
      reply.code(400).send({ error: 'INVALID_INPUT', message: 'refreshToken 不能为空' });
      return;
    }

    const payload = await verifyRefreshToken(app, refreshToken);

    if (!payload) {
      reply.code(401).send({ error: 'INVALID_REFRESH_TOKEN', message: '登录状态已过期' });
      return;
    }

    const user = await findUserByRefreshJti(payload.jti);

    if (!user) {
      reply.code(401).send({ error: 'INVALID_REFRESH_TOKEN', message: '登录状态已过期' });
      return;
    }

    await revokeRefreshToken(payload.jti);
    return buildTokenPair(app, user);
  });

  app.post<{ Body: LogoutBody }>('/logout', async (request, reply) => {
    const refreshToken = request.body?.refreshToken;

    if (refreshToken) {
      const payload = await verifyRefreshToken(app, refreshToken);
      if (payload) {
        await revokeRefreshToken(payload.jti);
      }
    }

    reply.code(204).send();
  });

  app.get('/me', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    return { user };
  });
}
