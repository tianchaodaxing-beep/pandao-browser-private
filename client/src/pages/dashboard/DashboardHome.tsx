import type { ProxyDto, Workspace } from 'shared';

type DashboardHomeProps = {
  workspaces: Workspace[];
  proxies: ProxyDto[];
  onActivate: (workspace: Workspace) => void;
  onCreateWorkspace: () => void;
  onGoExtensions: () => void;
  onGoProxies: () => void;
};

const platformBadge: Record<string, { label: string; color: string }> = {
  coupang: { label: 'Coupang', color: '#dc2626' },
  naver_smartstore: { label: 'Naver', color: '#03c75a' },
  gmarket: { label: 'Gmarket', color: '#1e40af' },
  '11st': { label: '11번가', color: '#ef4444' },
  erp: { label: 'ERP', color: '#16a34a' }
};

function platformChip(platform: string) {
  const meta = platformBadge[platform] ?? { label: platform, color: '#64748b' };
  return (
    <span className="platform-chip" style={{ background: meta.color }}>
      {meta.label}
    </span>
  );
}

function groupBy<T>(list: T[], key: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of list) {
    const k = key(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  }
  return [...map.entries()];
}

export function DashboardHome({
  workspaces,
  proxies,
  onActivate,
  onCreateWorkspace,
  onGoExtensions,
  onGoProxies
}: DashboardHomeProps) {
  const availableProxies = proxies.filter((p) => p.status === 'active' && p.boundShopId === null);
  const reservedProxies = proxies.filter((p) => p.boundShopId !== null);
  const grouped = groupBy(workspaces, (w) => w.category ?? '未分组');

  return (
    <div className="dashboard">
      {/* 顶部三联卡片(类似紫鸟) */}
      <section className="dashboard-stats">
        <article className="stat-card stat-card-emerald">
          <header>
            <span className="stat-card-icon">🏪</span>
            <h3>工作台</h3>
          </header>
          <div className="stat-card-value">{workspaces.length}</div>
          <p className="stat-card-sub">{grouped.length} 个分类</p>
          <button className="stat-card-action" type="button" onClick={onCreateWorkspace}>
            新建工作台 →
          </button>
        </article>

        <article className="stat-card stat-card-amber">
          <header>
            <span className="stat-card-icon">🌐</span>
            <h3>代理 IP</h3>
          </header>
          <div className="stat-card-value">
            {availableProxies.length}
            <span className="stat-card-value-sub">/ {proxies.length}</span>
          </div>
          <p className="stat-card-sub">空闲 · 已用 {reservedProxies.length}</p>
          <button className="stat-card-action" type="button" onClick={onGoProxies}>
            管理代理 →
          </button>
        </article>

        <article className="stat-card stat-card-blue">
          <header>
            <span className="stat-card-icon">🧩</span>
            <h3>扩展插件</h3>
          </header>
          <div className="stat-card-value">0</div>
          <p className="stat-card-sub">已装 0 · 启用 0</p>
          <button className="stat-card-action" type="button" onClick={onGoExtensions}>
            安装插件 →
          </button>
        </article>
      </section>

      {/* 主网格:左 2/3 工作台列表 + 右 1/3 提示 */}
      <section className="dashboard-grid">
        <div className="dashboard-main">
          <div className="dashboard-section-head">
            <div>
              <p className="eyebrow">您的工作台</p>
              <h2>所有账号({workspaces.length})</h2>
            </div>
            <button className="secondary-button inline" type="button" onClick={onCreateWorkspace}>
              + 新建
            </button>
          </div>

          {workspaces.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📭</span>
              <p>还没有工作台,点 "新建" 开始</p>
            </div>
          ) : (
            <div className="ws-list">
              {workspaces.map((ws) => {
                const proxy = proxies.find((p) => p.id === ws.proxyId);
                return (
                  <article key={ws.id} className="ws-row" onClick={() => onActivate(ws)}>
                    <span className="ws-icon-large">{ws.icon ?? '🏪'}</span>
                    <div className="ws-row-main">
                      <div className="ws-row-title">
                        <strong>{ws.name}</strong>
                        {platformChip(ws.platform)}
                      </div>
                      <p className="ws-row-meta">
                        {ws.category ? `${ws.category} · ` : ''}
                        {proxy ? (
                          <span className="ws-proxy-on">
                            ● 代理 {proxy.country} · {proxy.host}:{proxy.port}
                          </span>
                        ) : (
                          <span className="ws-proxy-off">○ 未绑代理</span>
                        )}
                      </p>
                    </div>
                    <button className="ws-row-open" type="button" onClick={(e) => { e.stopPropagation(); onActivate(ws); }}>
                      打开
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="dashboard-side">
          <div className="side-card">
            <header>
              <span className="side-card-icon">💡</span>
              <h3>运营提示</h3>
            </header>
            <ul className="tip-list">
              <li>
                <span className="tip-tag tip-tag-hot">热</span>
                <div>
                  <strong>一店一 IP 严格执行</strong>
                  <p>Coupang/Naver 反作弊会查同 IP 多账号,务必每个工作台绑独立代理</p>
                </div>
              </li>
              <li>
                <span className="tip-tag tip-tag-new">新</span>
                <div>
                  <strong>插件可装 .crx / .zip</strong>
                  <p>Chrome 应用商店不支持,从开发者站下载 .crx 拖入即可</p>
                </div>
              </li>
              <li>
                <span className="tip-tag tip-tag-warn">注意</span>
                <div>
                  <strong>主密钥每天 unlock</strong>
                  <p>严格模式 server 重启后所有店铺凭证锁死,老板桌面 unlock 脚本一键开</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="side-card">
            <header>
              <span className="side-card-icon">⚡</span>
              <h3>快捷操作</h3>
            </header>
            <div className="quick-actions">
              <button className="secondary-button inline" type="button" onClick={onCreateWorkspace}>
                新建工作台
              </button>
              <button className="secondary-button inline" type="button" onClick={onGoProxies}>
                管理代理
              </button>
              <button className="secondary-button inline" type="button" onClick={onGoExtensions}>
                装插件
              </button>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
