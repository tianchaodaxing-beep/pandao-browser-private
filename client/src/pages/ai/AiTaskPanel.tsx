import { useEffect, useState } from 'react';
import type { AiTask, AuthUser, WsEvent } from 'shared';
import { connectPandaoWebSocket, type WsConnectionState } from '../../services/websocket';

type ShopPayload = {
  id: number;
  name: string;
} | null;

type AssignedPayload = {
  task?: AiTask;
  shop?: ShopPayload;
};

function isAssignedPayload(payload: unknown): payload is AssignedPayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const task = (payload as AssignedPayload).task;
  return Boolean(task && typeof task.id === 'number');
}

function upsertTask(tasks: AiTask[], task: AiTask) {
  const existingIndex = tasks.findIndex((item) => item.id === task.id);

  if (existingIndex < 0) {
    return [task, ...tasks];
  }

  return tasks.map((item) => (item.id === task.id ? task : item));
}

export function AiTaskPanel({ user }: { user: AuthUser }) {
  const [tasks, setTasks] = useState<AiTask[]>([]);
  const [connectionState, setConnectionState] = useState<WsConnectionState>('closed');
  const [runningTaskId, setRunningTaskId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canReceiveAiTasks = user.role === 'staff' || user.role === 'manager' || user.role === 'boss';

  async function loadAssigned() {
    if (!canReceiveAiTasks) {
      return;
    }

    setError('');
    try {
      const result = await window.pandao?.ai.list();
      setTasks(result?.tasks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI tasks');
    }
  }

  async function executeTask(taskId: number) {
    setRunningTaskId(taskId);
    setError('');
    setNotice('');

    try {
      const result = await window.pandao?.ai.execute(taskId);
      const latest = await window.pandao?.ai.get(taskId);
      if (latest?.task) {
        setTasks((current) => upsertTask(current, latest.task));
      }
      setNotice(result?.message ?? `Task ${taskId} ${result?.status ?? 'done'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI task execution failed');
    } finally {
      setRunningTaskId(null);
    }
  }

  useEffect(() => {
    void loadAssigned();

    if (!canReceiveAiTasks) {
      return undefined;
    }

    return connectPandaoWebSocket((event: WsEvent) => {
      if (event.type !== 'ai.task.assigned' || !isAssignedPayload(event.payload)) {
        return;
      }

      const { task, shop } = event.payload;
      if (!task) {
        return;
      }

      setTasks((current) => upsertTask(current, task));
      const shopName = shop?.name ?? `shop #${task.shopId}`;
      const confirmed = window.confirm(`AI task ${task.command} for ${shopName}. Execute now?`);
      if (confirmed) {
        void executeTask(task.id);
      }
    }, setConnectionState);
  }, [canReceiveAiTasks]);

  if (!canReceiveAiTasks) {
    return (
      <section className="panel-stack">
        <div className="panel">
          <p className="eyebrow">AI</p>
          <h2>AI task receiver</h2>
          <p className="summary compact">This account does not receive shop execution tasks.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel-stack">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">AI</p>
            <h2>AI task receiver</h2>
            <p className="summary compact">WebSocket: {connectionState}</p>
          </div>
          <button className="secondary-button inline" type="button" onClick={() => void loadAssigned()}>
            Refresh
          </button>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        {notice ? <p className="form-notice">{notice}</p> : null}
        {tasks.length === 0 ? <p className="summary compact">No assigned AI tasks.</p> : null}
        {tasks.length > 0 ? (
          <div className="shop-list ai-task-list">
            {tasks.map((task) => (
              <article className="shop-card" key={task.id}>
                <div className="shop-card-main">
                  <h3>{task.command}</h3>
                  <p>
                    #{task.id} / shop #{task.shopId} / {task.status} / {task.riskLevel}
                  </p>
                </div>
                <div className="shop-card-actions">
                  <span>{task.approvalRequired ? 'approval' : 'green'}</span>
                  <button
                    className="shop-open-button"
                    type="button"
                    disabled={runningTaskId === task.id || task.status === 'done' || task.status === 'failed'}
                    onClick={() => void executeTask(task.id)}
                  >
                    {runningTaskId === task.id ? 'Running' : 'Execute'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
