import type { AiTask, AuthUser, EvaluationResult } from 'shared';

type BoundaryAlertInput = {
  user: AuthUser;
  shopId: number;
  command: string;
  payload: unknown;
  decision: EvaluationResult;
  frozenUntil: Date;
};

type OverdueApprovalAlertInput = {
  task: AiTask;
  reason: string;
};

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`webhook returned ${response.status}`);
  }
}

function formatPayload(payload: unknown) {
  try {
    return JSON.stringify(payload);
  } catch {
    return '[unserializable payload]';
  }
}

async function dispatchWebhookMessage(text: string, logPrefix: string) {
  const dingtalkWebhook = process.env.DINGTALK_WEBHOOK;
  const feishuWebhook = process.env.FEISHU_WEBHOOK;

  if (!dingtalkWebhook && !feishuWebhook) {
    console.log(`${logPrefix} no webhook configured`);
    return;
  }

  if (dingtalkWebhook) {
    try {
      await postJson(dingtalkWebhook, {
        msgtype: 'text',
        text: { content: text }
      });
    } catch (error) {
      console.log(`${logPrefix} dingtalk webhook failed`, error instanceof Error ? error.message : String(error));
    }
  }

  if (feishuWebhook) {
    try {
      await postJson(feishuWebhook, {
        msg_type: 'text',
        content: { text }
      });
    } catch (error) {
      console.log(`${logPrefix} feishu webhook failed`, error instanceof Error ? error.message : String(error));
    }
  }
}

export async function dispatchBoundaryRedAlert(input: BoundaryAlertInput) {
  const text = [
    'Boundary red alert',
    `AI: ${input.user.displayName ?? input.user.username}(id=${input.user.id})`,
    `Shop: ${input.shopId}`,
    `Command: ${input.command}`,
    `Reason: ${input.decision.reason}`,
    `Frozen until: ${input.frozenUntil.toISOString()}`,
    `Payload: ${formatPayload(input.payload)}`
  ].join('\n');

  await dispatchWebhookMessage(text, '[boundary-red]');
}

export async function dispatchApprovalOverdueAlert(input: OverdueApprovalAlertInput) {
  const text = [
    'AI approval overdue',
    `Task: #${input.task.id}`,
    `Shop: ${input.task.shopId}`,
    `Command: ${input.task.command}`,
    `Reason: ${input.reason}`
  ].join('\n');

  await dispatchWebhookMessage(text, '[approval-overdue]');
}
