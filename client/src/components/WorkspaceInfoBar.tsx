import type { Workspace } from 'shared';

type WorkspaceInfoBarProps = {
  workspace: Workspace | null;
  onDetach: () => void;
  onClose: () => void;
  onReload: () => void;
  onOpenDevTools: () => void;
};

export function WorkspaceInfoBar({ workspace, onDetach, onClose, onReload, onOpenDevTools }: WorkspaceInfoBarProps) {
  if (!workspace) {
    return (
      <div className="workspace-info-bar empty">
        <div>
          <strong>未激活工作区</strong>
          <span>从左侧选择 ERP、店铺或工具。</span>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-info-bar">
      <div>
        <strong>
          {workspace.icon ? `${workspace.icon} ` : ''}
          {workspace.name}
        </strong>
        <span>
          #{workspace.id} / {workspace.category ?? '未分组'} / {workspace.platform}
          {workspace.proxyId ? ` / Proxy #${workspace.proxyId}` : ''}
        </span>
      </div>
      <div className="info-actions">
        <button className="icon-button" type="button" title="刷新" onClick={onReload}>
          ↻
        </button>
        <button className="icon-button" type="button" title="分离窗口" onClick={onDetach}>
          ⧉
        </button>
        <button className="icon-button" type="button" title="DevTools" onClick={onOpenDevTools}>
          ⌘
        </button>
        <button className="icon-button danger" type="button" title="关闭" onClick={onClose}>
          ×
        </button>
      </div>
    </div>
  );
}
