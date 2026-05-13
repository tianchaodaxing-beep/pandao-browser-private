import type { AuthUser, Workspace } from 'shared';

export type AppView = 'workspaces' | 'extensions' | 'unlock' | 'proxies' | 'emergency' | 'ai' | 'approvals';

type SidebarProps = {
  user: AuthUser;
  workspaces: Workspace[];
  activeWorkspaceId: number | null;
  view: AppView;
  canManageProxies: boolean;
  canTriggerEmergency: boolean;
  canReceiveAiTasks: boolean;
  canApproveAiTasks: boolean;
  onViewChange: (view: AppView) => void;
  onActivateWorkspace: (workspace: Workspace) => void;
  onRefresh: () => void;
  onLogout: () => void;
};

type RailItem = {
  view: AppView;
  icon: string;
  label: string;
  show: boolean;
};

export function Sidebar({
  user,
  view,
  canManageProxies,
  canTriggerEmergency,
  canReceiveAiTasks,
  canApproveAiTasks,
  onViewChange,
  onLogout
}: SidebarProps) {
  // 紫鸟式 icon 栏:8 个一级导航 + 中文 1-2 字 label
  const items: RailItem[] = [
    { view: 'workspaces', icon: '🏠', label: '首页', show: true },
    { view: 'workspaces', icon: '🛒', label: '账号', show: true },
    { view: 'extensions', icon: '🧩', label: '插件', show: true },
    { view: 'proxies', icon: '🌐', label: '代理', show: canManageProxies },
    { view: 'ai', icon: '🤖', label: 'AI', show: canReceiveAiTasks },
    { view: 'approvals', icon: '✅', label: '审批', show: canApproveAiTasks },
    { view: 'emergency', icon: '🚨', label: '应急', show: canTriggerEmergency },
    { view: 'unlock', icon: '🔑', label: '密钥', show: true }
  ];

  return (
    <aside className="icon-rail">
      <div className="rail-logo">
        <span className="rail-logo-emoji">🐼</span>
        <span className="rail-logo-text">PANDAO</span>
      </div>

      <nav className="rail-nav" aria-label="主导航">
        {items
          .filter((item) => item.show)
          .map((item, idx) => (
            <button
              key={`${item.view}-${idx}`}
              type="button"
              className={view === item.view ? 'rail-item active' : 'rail-item'}
              onClick={() => onViewChange(item.view)}
              title={item.label}
            >
              <span className="rail-icon">{item.icon}</span>
              <span className="rail-label">{item.label}</span>
            </button>
          ))}
      </nav>

      <div className="rail-footer">
        <button className="rail-item rail-logout" type="button" onClick={onLogout} title="退出登录">
          <span className="rail-icon">⏻</span>
          <span className="rail-label">退出</span>
        </button>
        <div className="rail-user" title={user.displayName ?? user.username}>
          <span className="rail-avatar">
            {(user.displayName ?? user.username).slice(0, 1).toUpperCase()}
          </span>
        </div>
      </div>
    </aside>
  );
}
