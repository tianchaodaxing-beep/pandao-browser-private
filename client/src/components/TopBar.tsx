import type { AuthUser, Workspace, ProxyDto } from 'shared';
import { roleLabels } from '../modules/auth/roleLabels';

type TopBarProps = {
  user: AuthUser;
  workspaces: Workspace[];
  proxiesAvailable: number;
  onRefresh: () => void;
};

export function TopBar({ user, workspaces, proxiesAvailable, onRefresh }: TopBarProps) {
  const onlineCount = workspaces.filter((w) => w.status === 'active').length;

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <span className="company-logo">🐼</span>
        <div>
          <strong>PANDAO 浏览器</strong>
          <span className="company-tag">{user.displayName ?? user.username} · {roleLabels[user.role]}</span>
        </div>
        <button className="icon-button-light" type="button" onClick={onRefresh} title="刷新">
          ↻
        </button>
      </div>

      <div className="top-bar-right">
        <div className="stat-chip">
          <span className="stat-icon">🏪</span>
          <span className="stat-label">工作台</span>
          <strong>{workspaces.length}</strong>
        </div>
        <div className="stat-chip">
          <span className="stat-icon">🌐</span>
          <span className="stat-label">可用代理</span>
          <strong>{proxiesAvailable}</strong>
        </div>
        <div className="stat-chip">
          <span className="stat-icon">●</span>
          <span className="stat-label">可用工作台</span>
          <strong>{onlineCount}</strong>
        </div>
      </div>
    </header>
  );
}
