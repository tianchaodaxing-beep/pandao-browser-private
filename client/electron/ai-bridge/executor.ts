import type { AiTask, AiTaskExecutionResponse, AiTaskResultInput } from 'shared';
import { getShop, requestAuthedJson } from '../browser-engine/api-client.js';
import { openShop } from '../browser-engine/window-manager.js';

const starterCommands = new Set(['query.product.list', 'query.order.list', 'product.price.update']);

async function postTaskResult(taskId: number, body: AiTaskResultInput) {
  return requestAuthedJson<{ task: AiTask }>(`/ai/task/${taskId}/result`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

function notImplementedMessage(command: string) {
  if (starterCommands.has(command)) {
    return `${command} executor not implemented`;
  }

  return `AI command ${command} not implemented`;
}

export async function executeAiTask(taskId: number): Promise<AiTaskExecutionResponse> {
  const { task } = await requestAuthedJson<{ task: AiTask }>(`/ai/task/${taskId}`, {
    method: 'GET'
  });

  try {
    const shop = await getShop(task.shopId);
    await openShop(shop);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'failed to open shop window';
    await postTaskResult(taskId, {
      status: 'failed',
      message,
      result: {
        status: 'failed',
        message
      }
    });
    return {
      ok: true,
      taskId,
      status: 'failed',
      message
    };
  }

  const message = notImplementedMessage(task.command);
  await postTaskResult(taskId, {
    status: 'failed',
    message,
    result: {
      status: 'failed',
      message
    }
  });

  return {
    ok: true,
    taskId,
    status: 'failed',
    message
  };
}
