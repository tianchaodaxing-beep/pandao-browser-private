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
      <section className="login-panel">
        <div className="login-copy">
          <p className="eyebrow">PANDAO Browser</p>
          <h1>内部浏览器登录</h1>
          <p className="summary">使用老板账号进入本地工作台。登录态会保存在本机，不写入明文密码。</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>账号</span>
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
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
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button type="submit" disabled={loading}>
            {loading ? '登录中' : '登录'}
          </button>
        </form>
      </section>
    </main>
  );
}
