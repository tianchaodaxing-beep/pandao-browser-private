import { FormEvent, useState } from 'react';
import type { LoginRequest } from 'shared';

type LoginPageProps = {
  error: string | null;
  loading: boolean;
  onLogin: (credentials: LoginRequest) => Promise<void>;
};

export function LoginPage({ error, loading, onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('boss');
  const [password, setPassword] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onLogin({ username, password });
  }

  return (
    <main className="login-shell">
      <section className="login-hero">
        <p className="eyebrow">PANDAO 浏览器</p>
        <h1>一体式工作台<br />给中韩电商团队</h1>
        <p>
          替代紫鸟 + 日常 Chrome。一处管所有店铺、ERP、工具与插件。<br />
          账号一店一 IP,内置防关联指纹,登录态本机加密。
        </p>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <h2>登录</h2>
          <p className="form-summary">用您的工作台账号继续。第一次用?请联系老板获取账号。</p>

          <form onSubmit={handleSubmit}>
            <label>
              <span>账号</span>
              <input
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="boss / 员工账号"
                required
              />
            </label>

            <label>
              <span>密码</span>
              <input
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="至少 12 位"
                required
              />
            </label>

            {error ? <p className="form-error">{error}</p> : null}

            <button type="submit" disabled={loading}>
              {loading ? '登录中…' : '登录'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
