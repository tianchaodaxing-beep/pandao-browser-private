import type { AiTask } from 'shared';
import { sendWsEvent } from '../../ws/registry.js';
import {
  findActiveShop,
  findDispatchCandidates,
  setAiTaskAssignedTo,
  type DispatchCandidate
} from './repository.js';

const roundRobinCursorByShop = new Map<number, number>();

function pickCandidate(shopId: number, candidates: DispatchCandidate[]) {
  if (!candidates.length) {
    return null;
  }

  const cursor = roundRobinCursorByShop.get(shopId) ?? 0;
  const candidate = candidates[cursor % candidates.length];
  roundRobinCursorByShop.set(shopId, (cursor + 1) % candidates.length);
  return candidate;
}

export async function dispatchToShopStaff(task: AiTask): Promise<AiTask> {
  const candidates = await findDispatchCandidates(task.shopId);
  const candidate = pickCandidate(task.shopId, candidates);

  if (!candidate) {
    return task;
  }

  const assignedTask = await setAiTaskAssignedTo(task.id, candidate.userId);
  const latestTask = assignedTask ?? task;
  const shop = await findActiveShop(task.shopId);

  sendWsEvent(candidate.userId, 'ai.task.assigned', {
    task: latestTask,
    shop
  });

  return latestTask;
}

export function notifyAiTaskApproved(task: AiTask) {
  sendWsEvent(task.aiId, 'ai.task.approved', { task });
}

export function notifyAiTaskDenied(task: AiTask) {
  sendWsEvent(task.aiId, 'ai.task.denied', { task });
}
