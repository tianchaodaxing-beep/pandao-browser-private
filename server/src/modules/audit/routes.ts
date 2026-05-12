import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ActionLogInput } from 'shared';
import { authenticateRequest } from '../auth/guards.js';
import {
  AuditServiceError,
  MAX_SCREENSHOT_BYTES,
  createActionLog,
  saveScreenshotForLog
} from './service.js';

function sendAuditError(reply: FastifyReply, error: unknown) {
  if (error instanceof AuditServiceError) {
    reply.code(error.statusCode).send({ error: error.code, message: error.message });
    return true;
  }

  return false;
}

export async function auditRoutes(app: FastifyInstance) {
  app.post<{ Body: Partial<ActionLogInput> & { action_type?: string } }>('/log', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    try {
      const result = await createActionLog(
        user,
        request.body ?? {},
        request.ip ?? null,
        request.headers['user-agent'] ?? null
      );
      request.log.info(
        { action_type: request.body?.actionType ?? request.body?.action_type, actor_id: user.id },
        'action log inserted'
      );
      return result;
    } catch (error) {
      if (!sendAuditError(reply, error)) {
        throw error;
      }
    }
  });

  // TODO[WO-013]: add boss-only replay query APIs without exposing them to staff client UI.
  app.post('/screenshot', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    let logId = '';
    let screenshot: Buffer | null = null;

    try {
      for await (const part of request.parts({
        limits: {
          fileSize: MAX_SCREENSHOT_BYTES,
          files: 1
        }
      })) {
        if (part.type === 'file' && part.fieldname === 'screenshot') {
          if (part.mimetype !== 'image/png') {
            reply.code(400).send({ error: 'INVALID_INPUT', message: '截图必须是 PNG' });
            return;
          }
          screenshot = await part.toBuffer();
        } else if (part.type === 'field' && part.fieldname === 'log_id') {
          logId = String(part.value ?? '');
        }
      }

      if (!screenshot) {
        reply.code(400).send({ error: 'INVALID_INPUT', message: '缺少 screenshot 文件' });
        return;
      }

      return await saveScreenshotForLog(user, logId, screenshot);
    } catch (error) {
      if ((error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
        reply.code(413).send({ error: 'SCREENSHOT_TOO_LARGE', message: '截图不能超过 4MB' });
        return;
      }

      if (!sendAuditError(reply, error)) {
        throw error;
      }
    }
  });
}
