import { FormEvent, useEffect, useState } from 'react';
import type { BrowserExtension, ExtensionSourceType, Workspace } from 'shared';

type ExtensionsPageProps = {
  workspaces: Workspace[];
};

export function ExtensionsPage({ workspaces }: ExtensionsPageProps) {
  const [extensions, setExtensions] = useState<BrowserExtension[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [sourceType, setSourceType] = useState<Extract<ExtensionSourceType, 'crx' | 'zip'>>('crx');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const result = await window.pandao?.extensions.list();
      setExtensions(result?.extensions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取扩展失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submitFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError('请选择 .crx 或 .zip 文件');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await window.pandao?.extensions.installFile(file.name, bytes, sourceType);
      setFile(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '安装失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitGithub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = repoUrl.trim();
    if (!trimmed) {
      setError('请填写 GitHub repo URL');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await window.pandao?.extensions.installGithub({ sourceType: 'github', sourceUrl: trimmed });
      setRepoUrl('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '安装失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(extension: BrowserExtension) {
    setError('');
    try {
      await window.pandao?.extensions.toggle(extension.id, !extension.enabled);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '切换失败');
    }
  }

  async function uninstall(extensionId: string) {
    setError('');
    try {
      await window.pandao?.extensions.uninstall(extensionId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '卸载失败');
    }
  }

  async function bind(extensionId: string) {
    if (!selectedWorkspaceId) {
      setError('请选择要绑定的工作区');
      return;
    }

    setError('');
    try {
      await window.pandao?.extensions.bind(Number(selectedWorkspaceId), extensionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '绑定失败');
    }
  }

  return (
    <section className="panel-stack">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Extensions</p>
            <h2>Chrome 扩展</h2>
          </div>
          <button className="secondary-button inline" type="button" onClick={() => void load()}>
            刷新
          </button>
        </div>

        <div className="extension-install-grid">
          <form className="extension-form" onSubmit={submitFile}>
            <select value={sourceType} onChange={(event) => setSourceType(event.target.value as 'crx' | 'zip')}>
              <option value="crx">上传 .crx</option>
              <option value="zip">上传 .zip</option>
            </select>
            <input
              accept={sourceType === 'crx' ? '.crx' : '.zip'}
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <button className="secondary-button inline" type="submit" disabled={submitting}>
              安装
            </button>
          </form>

          <form className="extension-form" onSubmit={submitGithub}>
            <input value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="https://github.com/owner/repo" />
            <button className="secondary-button inline" type="submit" disabled={submitting}>
              从 GitHub 安装
            </button>
          </form>
        </div>

        <div className="extension-bind-row">
          <select value={selectedWorkspaceId} onChange={(event) => setSelectedWorkspaceId(event.target.value ? Number(event.target.value) : '')}>
            <option value="">选择绑定工作区</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {loading ? <p className="summary compact">正在读取扩展</p> : null}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>版本</th>
                <th>来源</th>
                <th>状态</th>
                <th>路径</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {extensions.map((extension) => (
                <tr key={extension.id}>
                  <td>{extension.name}</td>
                  <td>{extension.version ?? '-'}</td>
                  <td>{extension.sourceType}</td>
                  <td>{extension.enabled ? '启用' : '停用'}</td>
                  <td>{extension.installedPath}</td>
                  <td>
                    <div className="table-actions compact-actions">
                      <button className="secondary-button inline" type="button" onClick={() => void bind(extension.id)}>
                        绑定
                      </button>
                      <button className="secondary-button inline ghost" type="button" onClick={() => void toggle(extension)}>
                        {extension.enabled ? '停用' : '启用'}
                      </button>
                      <button className="shop-open-button danger" type="button" onClick={() => void uninstall(extension.id)}>
                        卸载
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
