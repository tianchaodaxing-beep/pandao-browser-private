import cron from 'node-cron';
import type { FastifyInstance } from 'fastify';
import { dispatchApprovalOverdueAlert } from '../modules/boundary/alert-webhook.js';
import { recordEmergencyEvent } from '../modules/boundary/engine.js';
import { findActiveBossIds, markOverduePendingAiTasks } from '../modules/ai/repository.js';
import { sendWsEvent } from '../ws/registry.js';

const OVERDUE_REASON = 'AI approval pending for more than 24 hours';

export async function runOverdueApprovalEscalation(app?: FastifyInstance) {
  const tasks = await markOverduePendingAiTasks();

  if (!tasks.length) {
    return { escalatedTasks: 0 };
  }

  const bossIds = await findActiveBossIds();

  for (const task of tasks) {
    await recordEmergencyEvent({
      triggeredBy: task.aiId,
      eventType: 'expired_approval',
      scope: 'task',
      scopeTargetId: task.id,
      reason: OVERDUE_REASON,
      affectedUsers: bossIds,
      metadata: {
        taskId: task.id,
        shopId: task.shopId,
        command: task.command
      }
    });

    for (const bossId of bossIds) {
      sendWsEvent(bossId, 'emergency.approval_overdue', { task, reason: OVERDUE_REASON });
    }

    await dispatchApprovalOverdueAlert({ task, reason: OVERDUE_REASON });
  }

  app?.log.info({ escalatedTasks: tasks.length }, 'overdue approval escalation finished');
  return { escalatedTasks: tasks.length };
}

export function startOverdueApprovalEscalation(app: FastifyInstance) {
  if (process.env.NODE_ENV !== 'production' || process.env.CRON_DISABLED === 'true') {
    app.log.info('overdue approval escalation cron disabled');
    return;
  }

  cron.schedule(
    '*/10 * * * *',
    () => {
      void runOverdueApprovalEscalation(app).catch((error) => {
        app.log.error(error, 'overdue approval escalation failed');
      });
    },
    { timezone: 'Asia/Shanghai' }
  );
}
