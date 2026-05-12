import type { FastifyInstance } from 'fastify';
import { getDbPool } from '../../db/pool.js';
import { authenticateRequest } from '../auth/guards.js';

export async function teamsRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    const result = await getDbPool().query(
      `SELECT id, name, manager_id
       FROM teams
       ORDER BY id ASC`
    );

    return {
      teams: result.rows.map((row) => ({
        id: Number(row.id),
        name: String(row.name),
        managerId: row.manager_id === null ? null : Number(row.manager_id)
      }))
    };
  });
}
