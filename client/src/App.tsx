import { useEffect, useRef, useState } from 'react';
import type { AuthUser, LoginRequest, Workspace } from 'shared';
import { Sidebar, type AppView } from './components/Sidebar';
import { WorkspaceInfoBar } from './components/WorkspaceInfoBar';
import { EmergencyPage } from './pages/admin/emergency/EmergencyPage';
import { ProxiesPage } from './pages/admin/proxies/ProxiesPage';
import { UnlockPage } from './pages/admin/unlock/UnlockPage';
import { AiTaskPanel } from './pages/ai/AiTaskPanel';
import { ExtensionsPage } from './pages/extensions/ExtensionsPage';
import { LoginPage } from './pages/login/LoginPage';
import { ApprovalsPage } from './pages/manager/ApprovalsPage';
import { WorkspaceList } from './pages/workspaces/WorkspaceList';

type AuthState =
  | { state: 'loading' }
  | { state: 'anonymous'; error: string | null }
  | { state: 'authenticated'; user: AuthUser };

export function App() {
  const [auth, setAuth] = useState<AuthState>({ state: 'loading' });
  const [view, setView] = useState<AppView>('workspaces');
  const [submitting, setSubmitting] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [workspaceError, setWorkspaceError] = useState('');
  const browserHostRef = useRef<HTMLDivElement | null>(null);

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

  async function loadWorkspaces() {
    setWorkspacesLoading(true);
    setWorkspaceError('');
    try {
      const result = await window.pandao?.workspaces.list();
      setWorkspaces(result?.workspaces ?? []);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : '读取工作区失败');
    } finally {
      setWorkspacesLoading(false);
    }
  }

  useEffect(() => {
    if (auth.state === 'authenticated') {
      void loadWorkspaces();
    }
  }, [auth.state]);

  useEffect(() => {
    const unsubscribe = window.pandao?.admin.onEmergencyLockout((payload) => {
      const message = `应急下线: ${payload.reason}`;
      window.alert(message);
      setActiveWorkspace(null);
      setView('workspaces');
      setAuth({ state: 'anonymous', error: message });
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const element = browserHostRef.current;
    if (!element || !activeWorkspace || view !== 'workspaces') {
      return;
    }

    const sendBounds = () => {
      const rect = element.getBoundingClientRect();
      void window.pandao?.workspaces.setViewBounds({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      });
    };

    sendBounds();
    const observer = new ResizeObserver(sendBounds);
    observer.observe(element);
    window.addEventListener('resize', sendBounds);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', sendBounds);
    };
  }, [activeWorkspace, view]);

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
    if (activeWorkspace) {
      await window.pandao?.workspaces.close(activeWorkspace.id);
    }
    await window.pandao?.auth.logout();
    setActiveWorkspace(null);
    setAuth({ state: 'anonymous', error: null });
  }

  async function activateWorkspace(workspace: Workspace) {
    setWorkspaceError('');
    setView('workspaces');
    try {
      setActiveWorkspace(workspace);
      await window.pandao?.workspaces.activate(workspace.id);
    } catch (error) {
      setActiveWorkspace(null);
      setWorkspaceError(error instanceof Error ? error.message : '激活工作区失败');
    }
  }

  function changeView(nextView: AppView) {
    if (activeWorkspace && nextView !== 'workspaces') {
      void window.pandao?.workspaces.close(activeWorkspace.id);
      setActiveWorkspace(null);
    }
    setView(nextView);
  }

  if (auth.state === 'loading') {
    return (
      <main className="loading-shell">
        <section className="loading-panel">
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
  const canTriggerEmergency = auth.user.role === 'boss';
  const canReceiveAiTasks = auth.user.role === 'staff' || auth.user.role === 'manager' || auth.user.role === 'boss';
  const canApproveAiTasks = auth.user.role === 'manager' || auth.user.role === 'boss';

  return (
    <main className="desktop-shell">
      <Sidebar
        user={auth.user}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspace?.id ?? null}
        view={view}
        canManageProxies={canManageProxies}
        canTriggerEmergency={canTriggerEmergency}
        canReceiveAiTasks={canReceiveAiTasks}
        canApproveAiTasks={canApproveAiTasks}
        onViewChange={changeView}
        onActivateWorkspace={(workspace) => void activateWorkspace(workspace)}
        onRefresh={() => void loadWorkspaces()}
        onLogout={() => void handleLogout()}
      />

      <section className="main-workbench">
        {view === 'workspaces' ? (
          <>
            <WorkspaceInfoBar
              workspace={activeWorkspace}
              onDetach={() => activeWorkspace && void window.pandao?.workspaces.detach(activeWorkspace.id)}
              onClose={() => {
                if (activeWorkspace) {
                  void window.pandao?.workspaces.close(activeWorkspace.id);
                  setActiveWorkspace(null);
                }
              }}
              onReload={() => activeWorkspace && void window.pandao?.workspaces.reload(activeWorkspace.id)}
              onOpenDevTools={() => activeWorkspace && void window.pandao?.workspaces.openDevTools(activeWorkspace.id)}
            />
            {workspaceError ? <p className="form-error">{workspaceError}</p> : null}
            <div className={activeWorkspace ? 'browser-host active' : 'browser-host'} ref={browserHostRef}>
              {!activeWorkspace ? (
                <WorkspaceList
                  workspaces={workspaces}
                  loading={workspacesLoading}
                  onCreated={() => void loadWorkspaces()}
                  onActivate={(workspace) => void activateWorkspace(workspace)}
                />
              ) : null}
            </div>
          </>
        ) : null}

        {view === 'extensions' ? <ExtensionsPage workspaces={workspaces} /> : null}
        {view === 'unlock' ? <UnlockPage user={auth.user} onUnlocked={() => setView('workspaces')} /> : null}
        {view === 'proxies' && canManageProxies ? <ProxiesPage /> : null}
        {view === 'emergency' && canTriggerEmergency ? <EmergencyPage /> : null}
        {view === 'ai' && canReceiveAiTasks ? <AiTaskPanel user={auth.user} /> : null}
        {view === 'approvals' && canApproveAiTasks ? <ApprovalsPage user={auth.user} /> : null}
      </section>
    </main>
  );
}
