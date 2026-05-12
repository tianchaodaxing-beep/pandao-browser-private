import { ChangeEvent, useEffect, useState } from 'react';
import type { AuthUser } from 'shared';

type UnlockPageProps = {
  user: AuthUser;
  onUnlocked?: () => void;
};

export function UnlockPage({ user, onUnlocked }: UnlockPageProps) {
  const [locked, setLocked] = useState<boolean | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    window.pandao?.admin.lockStatus()
      .then((result) => {
        if (active) setLocked(result.locked);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : '读取锁定状态失败');
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError('');
    setNotice('');

    if (!file) {
      return;
    }
    if (user.role !== 'boss') {
      setError('只有老板账号可以解锁主密钥');
      return;
    }
    if (file.size !== 32) {
      setError('master.key 必须正好 32 字节');
      return;
    }

    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await window.pandao?.admin.unlock(bytes);
      bytes.fill(0);
      setLocked(result?.locked ?? true);
      setNotice('主密钥已注入内存。服务器重启后需要老板重新解锁。');
      onUnlocked?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '解锁失败');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  return (
    <section className="panel-stack">
      <div className="panel">
        <p className="eyebrow">主密钥</p>
        <h2>店铺账号库解锁</h2>
        <p className="summary compact">
          只上传老板本机的 master.key。文件只通过接口进入服务器内存，不保存到服务器磁盘，也不会在界面显示内容。
        </p>
        <div className={`lock-badge ${locked === false ? 'ok' : 'warn'}`}>
          {locked === null ? '正在读取' : locked ? '已锁定' : '已解锁'}
        </div>
        <label className="file-picker">
          <span>{busy ? '解锁中' : '选择 master.key'}</span>
          <input type="file" disabled={busy || user.role !== 'boss'} onChange={handleFile} />
        </label>
        {notice ? <p className="form-notice">{notice}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </section>
  );
}
