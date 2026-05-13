import { FormEvent, useState } from 'react';
import type { Workspace, WorkspacePlatform } from 'shared';

const platformOptions: { value: WorkspacePlatform; label: string }[] = [
  { value: 'coupang', label: 'Coupang' },
  { value: 'naver_smartstore', label: 'Naver SmartStore' },
  { value: 'gmarket', label: 'Gmarket' },
  { value: '11st', label: '11st' },
  { value: 'erp', label: 'ERP' },
  { value: 'tool', label: '工具' },
  { value: 'custom', label: '自定义' }
];

type WorkspaceListProps = {
  workspaces: Workspace[];
  loading: boolean;
  onCreated: () => void;
  onActivate: (workspace: Workspace) => void;
};

export function WorkspaceList({ workspaces, loading, onCreated, onActivate }: WorkspaceListProps) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<WorkspacePlatform>('coupang');
  const [category, setCategory] = useState('电商');
  const [icon, setIcon] = useState('🛒');
  const [defaultUrl, setDefaultUrl] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const trimmed = name.trim();
    if (!trimmed) {
      setError('请填写工作区名称');
      return;
    }

    setSubmitting(true);
    try {
      await window.pandao?.workspaces.create({
        name: trimmed,
        platform,
        category: category.trim() || null,
        icon: icon.trim() || null,
        defaultUrl: defaultUrl.trim() || null
      });
      setName('');
      setDefaultUrl('');
      setShowForm(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel-stack">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Workspaces</p>
            <h2>工作区列表</h2>
          </div>
          <button className="secondary-button inline" type="button" onClick={() => setShowForm((value) => !value)}>
            {showForm ? '取消' : '新建工作区'}
          </button>
        </div>

        {showForm ? (
          <form className="workspace-form" onSubmit={submit}>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="工作区名称" />
            <select value={platform} onChange={(event) => setPlatform(event.target.value as WorkspacePlatform)}>
              {platformOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="分类" />
            <input value={icon} onChange={(event) => setIcon(event.target.value)} placeholder="图标" />
            <input value={defaultUrl} onChange={(event) => setDefaultUrl(event.target.value)} placeholder="默认 URL" />
            <button className="secondary-button inline" type="submit" disabled={submitting}>
              {submitting ? '创建中' : '创建'}
            </button>
          </form>
        ) : null}

        {error ? <p className="form-error">{error}</p> : null}
        {loading ? <p className="summary compact">正在读取工作区</p> : null}

        <div className="workspace-card-grid">
          {workspaces.map((workspace) => (
            <article className="workspace-card" key={workspace.id}>
              <div>
                <h3>
                  {workspace.icon ? `${workspace.icon} ` : ''}
                  {workspace.name}
                </h3>
                <p>
                  #{workspace.id} / {workspace.category ?? '未分组'} / {workspace.platform}
                </p>
                <p>{workspace.defaultUrl ?? '使用平台默认 URL'}</p>
              </div>
              <button className="shop-open-button" type="button" onClick={() => onActivate(workspace)}>
                激活
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
