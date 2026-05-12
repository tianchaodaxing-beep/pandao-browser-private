import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { EmergencyStatusResponse, LockoutScope } from 'shared';

const scopeLabels: Record<LockoutScope, string> = {
  all: '全员',
  team: '团队',
  employee: '员工',
  shop: '店铺'
};

const targetLabels: Record<Exclude<LockoutScope, 'all'>, string> = {
  team: '团队 ID',
  employee: '用户 ID',
  shop: '店铺 ID'
};

export function EmergencyPage() {
  const [scope, setScope] = useState<LockoutScope>('all');
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<EmergencyStatusResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      try {
        const response = await window.pandao?.admin.emergencyStatus();
        if (active && response) {
          setStatus(response);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : '无法读取应急状态');
        }
      }
    }

    void loadStatus();

    return () => {
      active = false;
    };
  }, []);

  const targetRequired = scope !== 'all';
  const parsedTargetId = useMemo(() => {
    const parsed = Number(targetId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [targetId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);

    const trimmedReason = reason.trim();
    if (trimmedReason.length < 4) {
      setError('原因至少 4 个字符');
      return;
    }

    if (targetRequired && !parsedTargetId) {
      setError('请输入有效的目标 ID');
      return;
    }

    const targetText = scope === 'all' ? '全员' : `${scopeLabels[scope]} #${parsedTargetId}`;
    if (!window.confirm(`确认应急下线 ${targetText}？`)) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await window.pandao?.admin.emergencyLockout({
        scope,
        targetId: scope === 'all' ? null : parsedTargetId,
        reason: trimmedReason
      });
      if (!response) {
        throw new Error('客户端 IPC 未就绪');
      }

      setNotice(`已触发应急下线，影响 ${response.affected.length} 个用户，事件 ID ${response.eventId}`);
      const latestStatus = await window.pandao?.admin.emergencyStatus();
      if (latestStatus) {
        setStatus(latestStatus);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '应急下线失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel-stack">
      <section className="panel emergency-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Emergency</p>
            <h2>应急下线</h2>
            <p className="summary compact">关闭目标客户端会话、清理本地登录态，并写入应急事件。</p>
          </div>
          {status ? (
            <dl className="emergency-status">
              <div>
                <dt>24h</dt>
                <dd>{status.lockoutsLast24h}</dd>
              </div>
              <div>
                <dt>当前账号</dt>
                <dd>{status.selfLockedOut ? '已命中' : '正常'}</dd>
              </div>
            </dl>
          ) : null}
        </div>

        <form className="emergency-form" onSubmit={handleSubmit}>
          <div className="segmented-control" aria-label="应急范围">
            {(['all', 'team', 'employee', 'shop'] as LockoutScope[]).map((item) => (
              <button
                className={scope === item ? 'scope-button active' : 'scope-button'}
                key={item}
                type="button"
                onClick={() => {
                  setScope(item);
                  setTargetId('');
                }}
              >
                {scopeLabels[item]}
              </button>
            ))}
          </div>

          {targetRequired ? (
            <label className="target-field">
              <span>{targetLabels[scope]}</span>
              <input
                inputMode="numeric"
                min="1"
                type="number"
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
                required
              />
            </label>
          ) : null}

          <label className="target-field">
            <span>原因</span>
            <textarea
              minLength={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="例如: 账号异常，先全员下线排查"
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}
          {notice ? <p className="form-notice">{notice}</p> : null}

          <button className="shop-open-button danger emergency-submit" type="submit" disabled={submitting}>
            {submitting ? '处理中' : '执行应急下线'}
          </button>
        </form>
      </section>
    </div>
  );
}
