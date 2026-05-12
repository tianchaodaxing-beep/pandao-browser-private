type AccessTokenEntry = {
  userId: number;
  expiresAt: Date;
};

const blacklistedJtis = new Map<string, Date>();
const activeAccessTokens = new Map<string, AccessTokenEntry>();

export function addToBlacklist(jti: string, expiresAt: Date) {
  if (expiresAt.getTime() <= Date.now()) {
    blacklistedJtis.delete(jti);
    activeAccessTokens.delete(jti);
    return;
  }

  blacklistedJtis.set(jti, expiresAt);
  activeAccessTokens.delete(jti);
}

export function isBlacklisted(jti: string | undefined, now = new Date()) {
  if (!jti) {
    return false;
  }

  const expiresAt = blacklistedJtis.get(jti);
  if (!expiresAt) {
    return false;
  }

  if (expiresAt.getTime() <= now.getTime()) {
    blacklistedJtis.delete(jti);
    return false;
  }

  return true;
}

export function registerAccessToken(jti: string, userId: number, expiresAt: Date) {
  if (expiresAt.getTime() <= Date.now()) {
    return;
  }

  activeAccessTokens.set(jti, { userId, expiresAt });
}

export function blacklistAccessTokensForUsers(userIds: number[], now = new Date()) {
  const affected = new Set(userIds);
  let blacklisted = 0;

  for (const [jti, entry] of activeAccessTokens.entries()) {
    if (entry.expiresAt.getTime() <= now.getTime()) {
      activeAccessTokens.delete(jti);
      continue;
    }

    if (!affected.has(entry.userId)) {
      continue;
    }

    addToBlacklist(jti, entry.expiresAt);
    blacklisted += 1;
  }

  return blacklisted;
}

export function clearExpired(now = new Date()) {
  const nowMs = now.getTime();

  for (const [jti, expiresAt] of blacklistedJtis.entries()) {
    if (expiresAt.getTime() <= nowMs) {
      blacklistedJtis.delete(jti);
    }
  }

  for (const [jti, entry] of activeAccessTokens.entries()) {
    if (entry.expiresAt.getTime() <= nowMs) {
      activeAccessTokens.delete(jti);
    }
  }
}

export function clearBlacklistStateForTests() {
  blacklistedJtis.clear();
  activeAccessTokens.clear();
}
