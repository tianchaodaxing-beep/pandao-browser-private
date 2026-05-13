import type { AuthUser, Workspace } from 'shared';
import { roleLabels } from '../modules/auth/roleLabels';

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

function groupWorkspaces(workspaces: Workspace[]) {
  const groups = new Map<string, Workspace[]>();
  for (const workspace of workspaces) {
    const category = workspace.category ?? '未分组';
    groups.set(category, [...(groups.get(category) ?? []), workspace]);
  }
  return [...groups.entries()];
}

export function Sidebar({
  user,
  workspaces,
  activeWorkspaceId,
  view,
  canManageProxies,
  canTriggerEmergency,
  canReceiveAiTasks,
  canApproveAiTasks,
  onViewChange,
  onActivateWorkspace,
  onRefresh,
  onLogout
}: SidebarProps) {
  const groups = groupWorkspaces(workspaces);

  return (
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <div>
          <p className="eyebrow">PANDAO</p>
          <h1>工作区</h1>
        </div>
        <button className="icon-button" type="button" title="刷新" onClick={onRefresh}>
          ↻
        </button>
      </div>

      <div className="sidebar-user">
        <strong>{user.displayName ?? user.username}</strong>
        <span>{roleLabels[user.role]}</span>
      </div>

      <nav className="sidebar-nav" aria-label="主导航">
        <button className={view === 'workspaces' ? 'nav-button active' : 'nav-button'} type="button" onClick={() => onViewChange('workspaces')}>
          工作区管理
        </button>
        <button className={view === 'extensions' ? 'nav-button active' : 'nav-button'} type="button" onClick={() => onViewChange('extensions')}>
          扩展管理
        </button>
        <button className={view === 'unlock' ? 'nav-button active' : 'nav-button'} type="button" onClick={() => onViewChange('unlock')}>
          主密钥
        </button>
        {canManageProxies ? (
          <button className={view === 'proxies' ? 'nav-button active' : 'nav-button'} type="button" onClick={() => onViewChange('proxies')}>
            代理 IP
          </button>
        ) : null}
        {canTriggerEmergency ? (
          <button className={view === 'emergency' ? 'nav-button active' : 'nav-button'} type="button" onClick={() => onViewChange('emergency')}>
            应急
          </button>
        ) : null}
        {canReceiveAiTasks ? (
          <button className={view === 'ai' ? 'nav-button active' : 'nav-button'} type="button" onClick={() => onViewChange('ai')}>
            AI 任务
          </button>
        ) : null}
        {canApproveAiTasks ? (
          <button className={view === 'approvals' ? 'nav-button active' : 'nav-button'} type="button" onClick={() => onViewChange('approvals')}>
            审批
          </button>
        ) : null}
      </nav>

      <div className="workspace-tree">
        {groups.map(([category, items]) => (
          <section key={category}>
            <h2>{category}</h2>
            {items.map((workspace) => (
              <button
                className={activeWorkspaceId === workspace.id ? 'workspace-row active' : 'workspace-row'}
                key={workspace.id}
                type="button"
                onClick={() => onActivateWorkspace(workspace)}
              >
                <span>{workspace.icon ?? '•'}</span>
                <strong>{workspace.name}</strong>
              </button>
            ))}
          </section>
        ))}
      </div>

      <button className="nav-button logout" type="button" onClick={onLogout}>
        退出登录
      </button>
    </aside>
  );
}
