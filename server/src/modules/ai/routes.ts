import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AiTaskInput, AiTaskResultInput, AiTaskSubmitResponse } from 'shared';
import { authenticateRequest } from '../auth/guards.js';
import {
  AiServiceError,
  approveAiTaskForUser,
  denyAiTaskForUser,
  getAiTaskForUser,
  listAssignedAiTasks,
  listPendingApprovalTasks,
  parseTaskId,
  submitAiTask,
  submitAiTaskResult
} from './service.js';

type TaskParams = {
  id: string;
};

type DenyBody = {
  reason?: unknown;
};

function sendAiError(reply: FastifyReply, error: unknown) {
  if (error instanceof AiServiceError) {
    reply.code(error.statusCode).send({ error: error.code, message: error.message });
    return true;
  }

  return false;
}

function readReason(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function aiRoutes(app: FastifyInstance) {
  app.post<{ Body: Partial<AiTaskInput> }>('/task', async (request, reply): Promise<AiTaskSubmitResponse | void> => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    try {
      const task = await submitAiTask(user, request.body ?? {});
      return {
        id: task.id,
        status: task.status,
        riskLevel: task.riskLevel,
        approvalRequired: task.approvalRequired
      };
    } catch (error) {
      if (!sendAiError(reply, error)) {
        throw error;
      }
    }
  });

  app.get('/tasks/assigned', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    try {
      return { tasks: await listAssignedAiTasks(user) };
    } catch (error) {
      if (!sendAiError(reply, error)) {
        throw error;
      }
    }
  });

  app.get('/tasks/pending', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    try {
      return { tasks: await listPendingApprovalTasks(user) };
    } catch (error) {
      if (!sendAiError(reply, error)) {
        throw error;
      }
    }
  });

  app.get<{ Params: TaskParams }>('/task/:id', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    const taskId = parseTaskId(request.params.id);
    if (!taskId) {
      reply.code(404).send({ error: 'TASK_NOT_FOUND', message: 'task not found' });
      return;
    }

    try {
      return { task: await getAiTaskForUser(user, taskId) };
    } catch (error) {
      if (!sendAiError(reply, error)) {
        throw error;
      }
    }
  });

  app.post<{ Params: TaskParams }>('/task/:id/approve', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    const taskId = parseTaskId(request.params.id);
    if (!taskId) {
      reply.code(404).send({ error: 'TASK_NOT_FOUND', message: 'task not found' });
      return;
    }

    try {
      return { task: await approveAiTaskForUser(user, taskId) };
    } catch (error) {
      if (!sendAiError(reply, error)) {
        throw error;
      }
    }
  });

  app.post<{ Params: TaskParams; Body: DenyBody }>('/task/:id/deny', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    const taskId = parseTaskId(request.params.id);
    if (!taskId) {
      reply.code(404).send({ error: 'TASK_NOT_FOUND', message: 'task not found' });
      return;
    }

    try {
      return { task: await denyAiTaskForUser(user, taskId, readReason(request.body?.reason)) };
    } catch (error) {
      if (!sendAiError(reply, error)) {
        throw error;
      }
    }
  });

  app.post<{ Params: TaskParams; Body: Partial<AiTaskResultInput> }>('/task/:id/result', async (request, reply) => {
    const user = await authenticateRequest(request, reply);

    if (!user) {
      return;
    }

    const taskId = parseTaskId(request.params.id);
    if (!taskId) {
      reply.code(404).send({ error: 'TASK_NOT_FOUND', message: 'task not found' });
      return;
    }

    try {
      return { task: await submitAiTaskResult(user, taskId, request.body ?? {}) };
    } catch (error) {
      if (!sendAiError(reply, error)) {
        throw error;
      }
    }
  });
}
