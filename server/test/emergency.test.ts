import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  blacklistAccessTokensForUsers,
  clearBlacklistStateForTests,
  clearExpired,
  isBlacklisted,
  registerAccessToken
} from '../src/modules/emergency/blacklist.ts';
import {
  listAffectedUsersByEmployee,
  listAffectedUsersByScope,
  type EmergencyDb
} from '../src/modules/emergency/repository.ts';
import { EmergencyValidationError, normalizeLockoutRequest } from '../src/modules/emergency/service.ts';

type UserRow = {
  id: number;
  teamId: number | null;
  status: 'active' | 'disabled' | 'frozen';
};

function makeEmergencyDb(): EmergencyDb {
  const users: UserRow[] = [
    { id: 1, teamId: 10, status: 'active' },
    { id: 2, teamId: null, status: 'active' },
    { id: 3, teamId: 10, status: 'disabled' },
    { id: 4, teamId: 20, status: 'active' },
    { id: 5, teamId: 10, status: 'active' }
  ];
  const teams = [{ id: 10, managerId: 2 }];
  const shops = [{ id: 100, teamId: 10 }];
  const shopAssignments = [
    { shopId: 100, userId: 3 },
    { shopId: 100, userId: 4 },
    { shopId: 100, userId: 5 }
  ];

  return {
    async query(sql: string, params: unknown[] = []) {
      const targetId = Number(params[0]);

      if (sql.includes('SELECT id FROM teams')) {
        const rows = teams.filter((team) => team.id === targetId).map((team) => ({ id: team.id }));
        return { rowCount: rows.length, rows };
      }

      if (sql.includes('SELECT id FROM shops')) {
        const rows = shops.filter((shop) => shop.id === targetId).map((shop) => ({ id: shop.id }));
        return { rowCount: rows.length, rows };
      }

      if (sql.includes("WHERE status = 'active'") && !sql.includes('DISTINCT') && params.length === 0) {
        const rows = users.filter((user) => user.status === 'active').map((user) => ({ id: user.id }));
        return { rowCount: rows.length, rows };
      }

      if (sql.includes('WHERE id = $1') && sql.includes("status = 'active'")) {
        const rows = users
          .filter((user) => user.id === targetId && user.status === 'active')
          .map((user) => ({ id: user.id }));
        return { rowCount: rows.length, rows };
      }

      if (sql.includes('LEFT JOIN teams t ON t.id = $1')) {
        const team = teams.find((candidate) => candidate.id === targetId);
        const ids = new Set(
          users
            .filter((user) => user.status === 'active' && (user.teamId === targetId || user.id === team?.managerId))
            .map((user) => user.id)
        );
        const rows = Array.from(ids)
          .sort((a, b) => a - b)
          .map((id) => ({ id }));
        return { rowCount: rows.length, rows };
      }

      if (sql.includes('LEFT JOIN shop_assignments')) {
        const shop = shops.find((candidate) => candidate.id === targetId);
        const team = teams.find((candidate) => candidate.id === shop?.teamId);
        const assignedIds = new Set(
          shopAssignments
            .filter((assignment) => assignment.shopId === targetId)
            .map((assignment) => assignment.userId)
        );
        const rows = users
          .filter(
            (user) =>
              user.status === 'active' && (assignedIds.has(user.id) || user.id === team?.managerId)
          )
          .sort((a, b) => a.id - b.id)
          .map((user) => ({ id: user.id }));
        return { rowCount: rows.length, rows };
      }

      throw new Error(`Unexpected query: ${sql}`);
    }
  } as EmergencyDb;
}

describe('emergency affected users', () => {
  it('resolves scope=all to all active users', async () => {
    const affected = await listAffectedUsersByScope({ scope: 'all', targetId: null }, makeEmergencyDb());

    assert.deepEqual(affected, [1, 2, 4, 5]);
  });

  it('resolves scope=team to active team members plus manager', async () => {
    const affected = await listAffectedUsersByScope({ scope: 'team', targetId: 10 }, makeEmergencyDb());

    assert.deepEqual(affected, [1, 2, 5]);
  });

  it('resolves scope=shop to active assignees plus shop team manager', async () => {
    const affected = await listAffectedUsersByScope({ scope: 'shop', targetId: 100 }, makeEmergencyDb());

    assert.deepEqual(affected, [2, 4, 5]);
  });

  it('does not return inactive employees for scope=employee', async () => {
    const affected = await listAffectedUsersByEmployee(3, makeEmergencyDb());

    assert.equal(affected, null);
  });
});

describe('emergency lockout validation', () => {
  it('normalizes snake_case target_id and trims reason', () => {
    assert.deepEqual(normalizeLockoutRequest({ scope: 'team', target_id: 10, reason: '  test  ' }), {
      scope: 'team',
      targetId: 10,
      reason: 'test'
    });
  });

  it('rejects missing target_id for targeted scopes', () => {
    assert.throws(
      () => normalizeLockoutRequest({ scope: 'shop', reason: 'test' }),
      (error) => error instanceof EmergencyValidationError && error.code === 'TARGET_REQUIRED'
    );
  });

  it('rejects short reasons', () => {
    assert.throws(
      () => normalizeLockoutRequest({ scope: 'all', reason: '' }),
      (error) => error instanceof EmergencyValidationError && error.code === 'INVALID_REASON'
    );
  });
});

describe('emergency JWT blacklist', () => {
  beforeEach(() => {
    clearBlacklistStateForTests();
  });

  it('blacklists only active tokens for affected users and clears expired entries', () => {
    const now = new Date('2026-05-13T00:00:00.000Z');
    const future = new Date(now.getTime() + 60_000);
    registerAccessToken('jti-user-1', 1, future);
    registerAccessToken('jti-user-2', 2, future);

    const blacklisted = blacklistAccessTokensForUsers([1], now);

    assert.equal(blacklisted, 1);
    assert.equal(isBlacklisted('jti-user-1', now), true);
    assert.equal(isBlacklisted('jti-user-2', now), false);

    clearExpired(new Date(future.getTime() + 1));
    assert.equal(isBlacklisted('jti-user-1', new Date(future.getTime() + 1)), false);
  });
});
