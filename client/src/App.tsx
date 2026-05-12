import { useEffect, useState } from 'react';
import type { AuthUser, LoginRequest } from 'shared';
import { roleLabels } from './modules/auth/roleLabels';
import { ProxiesPage } from './pages/admin/proxies/ProxiesPage';
import { UnlockPage } from './pages/admin/unlock/UnlockPage';
import { LoginPage } from './pages/login/LoginPage';
import { ShopsPage } from './pages/shops/ShopsPage';

type AuthState =
  | { state: 'loading' }
  | { state: 'anonymous'; error: string | null }
  | { state: 'authenticated'; user: AuthUser };

export function App() {
  const [auth, setAuth] = useState<AuthState>({ state: 'loading' });
  const [view, setView] = useState<'shops' | 'unlock' | 'proxies'>('shops');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function restore() {
      try {
        const user = await window.pandao?.auth.me();
        if (active) {
          setAuth(user ? { state: 'authenticated', user } : { state: 'anonymous', error: null });
        }
      } catch {
        if (active) setAuth({ state: 'anonymous', error: '无法读取本机登录态' });
      }
    }

    void restore();

    return () => {
      active = false;
    };
  }, []);

  async function handleLogin(credentials: LoginRequest) {
    setSubmitting(true);
    setAuth({ state: 'anonymous', error: null });

    try {
      const user = await window.pandao?.auth.login(credentials);
      if (!user) {
        throw new Error('客户端 IPC 未就绪');
      }
      setAuth({ state: 'authenticated', user });
    } catch (error) {
      setAuth({ state: 'anonymous', error: error instanceof Error ? error.message : '登录失败' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await window.pandao?.auth.logout();
    setAuth({ state: 'anonymous', error: null });
  }

  if (auth.state === 'loading') {
    return (
      <main className="app-shell">
        <section className="workspace loading-panel">
          <p className="eyebrow">PANDAO Browser</p>
          <h1>正在读取登录态</h1>
        </section>
      </main>
    );
  }

  if (auth.state === 'anonymous') {
    return <LoginPage error={auth.error} loading={submitting} onLogin={handleLogin} />;
  }

  const canManageProxies = auth.user.role === 'boss';

  return (
    <main className="app-shell">
      <section className="workspace">
        <div>
          <p className="eyebrow">PANDAO Browser</p>
          <h1>内部浏览器工作台</h1>
          <p className="summary">
            当前用户:{auth.user.displayName ?? auth.user.username}({roleLabels[auth.user.role]})
          </p>
          <div className="toolbar">
            <button className={view === 'shops' ? 'secondary-button active' : 'secondary-button'} type="button" onClick={() => setView('shops')}>
              店铺列表
            </button>
            <button className={view === 'unlock' ? 'secondary-button active' : 'secondary-button'} type="button" onClick={() => setView('unlock')}>
              主密钥
            </button>
            {canManageProxies ? (
              <button className={view === 'proxies' ? 'secondary-button active' : 'secondary-button'} type="button" onClick={() => setView('proxies')}>
                代理 IP
              </button>
            ) : null}
            <button className="secondary-button ghost" type="button" onClick={handleLogout}>
              退出登录
            </button>
          </div>
        </div>
        {view === 'shops' ? <ShopsPage /> : null}
        {view === 'unlock' ? <UnlockPage user={auth.user} onUnlocked={() => setView('shops')} /> : null}
        {view === 'proxies' && canManageProxies ? <ProxiesPage /> : null}
      </section>
    </main>
  );
}
