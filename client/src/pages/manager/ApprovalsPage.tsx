import { useEffect, useState } from 'react';
import type { AiTask, AuthUser, WsEvent } from 'shared';
import { connectPandaoWebSocket, type WsConnectionState } from '../../services/websocket';

type TaskPayload = {
  task?: AiTask;
  reason?: string;
};

function isTaskPayload(payload: unknown): payload is TaskPayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const task = (payload as TaskPayload).task;
  return Boolean(task && typeof task.id === 'number');
}

function upsertTask(tasks: AiTask[], task: AiTask) {
  if (task.status !== 'pending') {
    return tasks.filter((item) => item.id !== task.id);
  }

  const existingIndex = tasks.findIndex((item) => item.id === task.id);
  if (existingIndex < 0) {
    return [task, ...tasks];
  }

  return tasks.map((item) => (item.id === task.id ? task : item));
}

function removeTask(tasks: AiTask[], taskId: number) {
  return tasks.filter((task) => task.id !== taskId);
}

export function ApprovalsPage({ user }: { user: AuthUser }) {
  const [tasks, setTasks] = useState<AiTask[]>([]);
  const [connectionState, setConnectionState] = useState<WsConnectionState>('closed');
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const canApprove = user.role === 'manager' || user.role === 'boss';

  async function loadPending() {
    if (!canApprove) {
      return;
    }

    setError('');
    try {
      const result = await window.pandao?.ai.pending();
      setTasks(result?.tasks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending approvals');
    }
  }

  async function approve(taskId: number) {
    setBusyTaskId(taskId);
    setError('');
    setNotice('');

    try {
      await window.pandao?.ai.approve(taskId);
      setTasks((current) => removeTask(current, taskId));
      setNotice(`Task #${taskId} approved`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setBusyTaskId(null);
    }
  }

  async function deny(taskId: number) {
    const reason = window.prompt('Deny reason', 'manager denied');
    if (reason === null) {
      return;
    }

    setBusyTaskId(taskId);
    setError('');
    setNotice('');

    try {
      await window.pandao?.ai.deny(taskId, reason);
      setTasks((current) => removeTask(current, taskId));
      setNotice(`Task #${taskId} denied`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deny failed');
    } finally {
      setBusyTaskId(null);
    }
  }

  useEffect(() => {
    void loadPending();

    if (!canApprove) {
      return undefined;
    }

    return connectPandaoWebSocket((event: WsEvent) => {
      if (event.type === 'ai.task.pending' && isTaskPayload(event.payload) && event.payload.task) {
        setTasks((current) => upsertTask(current, event.payload.task as AiTask));
        setNotice(`New pending AI task #${event.payload.task.id}`);
        return;
      }

      if (event.type === 'emergency.approval_overdue' && isTaskPayload(event.payload) && event.payload.task) {
        setTasks((current) => upsertTask(current, event.payload.task as AiTask));
        setNotice(event.payload.reason ?? `Task #${event.payload.task.id} approval overdue`);
      }
    }, setConnectionState);
  }, [canApprove]);

  if (!canApprove) {
    return (
      <section className="panel-stack">
        <div className="panel">
          <p className="eyebrow">AI</p>
          <h2>Pending approvals</h2>
          <p className="summary compact">This account cannot approve AI tasks.</p>
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
            <h2>Pending approvals</h2>
            <p className="summary compact">WebSocket: {connectionState}</p>
          </div>
          <button className="secondary-button inline" type="button" onClick={() => void loadPending()}>
            Refresh
          </button>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        {notice ? <p className="form-notice">{notice}</p> : null}
        {tasks.length === 0 ? <p className="summary compact">No pending AI approvals.</p> : null}
        {tasks.length > 0 ? (
          <div className="shop-list approval-task-list">
            {tasks.map((task) => (
              <article className="shop-card approval-task-card" key={task.id}>
                <div className="shop-card-main">
                  <h3>{task.command}</h3>
                  <p>
                    #{task.id} / shop #{task.shopId} / {task.status} / {task.riskLevel}
                  </p>
                  <pre className="task-payload">{JSON.stringify(task.payload, null, 2)}</pre>
                </div>
                <div className="shop-card-actions">
                  <span>{task.approvalRequired ? 'approval' : 'auto'}</span>
                  <button
                    className="shop-open-button"
                    type="button"
                    disabled={busyTaskId === task.id}
                    onClick={() => void approve(task.id)}
                  >
                    Approve
                  </button>
                  <button
                    className="shop-open-button danger"
                    type="button"
                    disabled={busyTaskId === task.id}
                    onClick={() => void deny(task.id)}
                  >
                    Deny
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
