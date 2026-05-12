import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import type { ProxyDto, ProxyInput, ProxyProvider, ProxyProtocol, Shop } from 'shared';

type ProxyFormState = {
  provider: ProxyProvider;
  protocol: ProxyProtocol;
  host: string;
  port: string;
  username: string;
  password: string;
  country: string;
  city: string;
};

const emptyForm: ProxyFormState = {
  provider: 'lunaproxy',
  protocol: 'http',
  host: '',
  port: '',
  username: '',
  password: '',
  country: 'KR',
  city: ''
};

const providers: ProxyProvider[] = ['lunaproxy', '922s5'];
const protocols: ProxyProtocol[] = ['http', 'socks5'];
const csvHeader = ['provider', 'protocol', 'host', 'port', 'username', 'password', 'country', 'city'];

function isProxyProvider(value: string): value is ProxyProvider {
  return providers.includes(value as ProxyProvider);
}

function isProxyProtocol(value: string): value is ProxyProtocol {
  return protocols.includes(value as ProxyProtocol);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((char === '\r' || char === '\n') && !inQuotes) {
      row.push(field);
      field = '';
      if (row.some((item) => item.trim())) {
        rows.push(row);
      }
      row = [];
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((item) => item.trim())) {
    rows.push(row);
  }

  if (inQuotes) {
    throw new Error('CSV 引号未闭合');
  }

  return rows;
}

function parseProxyRowsFromCsv(text: string): ProxyInput[] {
  const rows = parseCsv(text);
  const header = rows.shift()?.map((item) => item.trim().toLowerCase());

  if (!header || csvHeader.some((name, index) => header[index] !== name)) {
    throw new Error(`CSV header 必须是 ${csvHeader.join(',')}`);
  }

  return rows.map((row, rowIndex) => {
    const record = new Map<string, string>();
    csvHeader.forEach((name, index) => record.set(name, row[index]?.trim() ?? ''));

    const provider = record.get('provider') ?? '';
    const protocol = record.get('protocol') ?? '';
    const host = record.get('host') ?? '';
    const port = Number(record.get('port'));

    if (!isProxyProvider(provider) || !isProxyProtocol(protocol) || !host || !Number.isInteger(port)) {
      throw new Error(`CSV 第 ${rowIndex + 2} 行不合法`);
    }

    return {
      provider,
      protocol,
      host,
      port,
      username: record.get('username') || null,
      password: record.get('password') || null,
      country: record.get('country') || 'KR',
      city: record.get('city') || null
    };
  });
}

function buildProxyInput(form: ProxyFormState): ProxyInput {
  const port = Number(form.port);

  if (!form.host.trim() || !Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('host 和 port 必须有效');
  }

  return {
    provider: form.provider,
    protocol: form.protocol,
    host: form.host.trim(),
    port,
    username: form.username.trim() || null,
    password: form.password || null,
    country: form.country.trim() || 'KR',
    city: form.city.trim() || null
  };
}

export function ProxiesPage() {
  const [proxies, setProxies] = useState<ProxyDto[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopByProxy, setSelectedShopByProxy] = useState<Record<number, string>>({});
  const [form, setForm] = useState<ProxyFormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const api = window.pandao;

    if (!api) {
      throw new Error('IPC 未就绪');
    }

    setLoading(true);
    setError('');
    const [proxyResult, shopResult] = await Promise.all([
      api.admin.listProxies(),
      api.shops.list()
    ]);
    setProxies(proxyResult.proxies);
    setShops(shopResult.shops);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;

    load().catch((err) => {
      if (active) {
        setLoading(false);
        setError(err instanceof Error ? err.message : '读取代理失败');
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const shopNameById = useMemo(() => {
    return new Map(shops.map((shop) => [shop.id, shop.name]));
  }, [shops]);

  function availableShops(proxy: ProxyDto) {
    return shops.filter((shop) => shop.status === 'active' && (shop.proxyId === null || shop.proxyId === proxy.id));
  }

  async function submitRows(rows: ProxyInput[], message: string) {
    const api = window.pandao;

    if (!api) {
      throw new Error('IPC 未就绪');
    }

    setBusy(true);
    setError('');
    setNotice('');

    try {
      const result = await api.admin.batchProxies({ rows });
      setNotice(`${message}: ${result.inserted.length} 条`);
      await load();
    } finally {
      for (const row of rows) {
        row.password = null;
      }
      setBusy(false);
    }
  }

  async function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await submitRows([buildProxyInput(form)], '已录入代理');
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : '录入代理失败');
    }
  }

  async function handleCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    try {
      const rows = parseProxyRowsFromCsv(await file.text());
      await submitRows(rows, '已导入代理');
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入代理失败');
    }
  }

  async function bind(proxy: ProxyDto) {
    const api = window.pandao;
    const selected = Number(selectedShopByProxy[proxy.id]);

    if (!api || !selected) {
      setError('请选择店铺');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    try {
      await api.admin.bindProxy(proxy.id, selected);
      setNotice('代理已绑定');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '绑定代理失败');
    } finally {
      setBusy(false);
    }
  }

  async function unbind(proxy: ProxyDto) {
    const api = window.pandao;

    if (!api) {
      setError('IPC 未就绪');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    try {
      await api.admin.unbindProxy(proxy.id);
      setNotice('代理已解绑');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '解绑代理失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel-stack">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">代理 IP</p>
            <h2>LunaProxy / 922S5</h2>
          </div>
          <button className="secondary-button inline" type="button" onClick={() => void load()} disabled={busy}>
            刷新
          </button>
        </div>

        <form className="proxy-form" onSubmit={handleManualSubmit}>
          <select value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value as ProxyProvider })}>
            <option value="lunaproxy">LunaProxy</option>
            <option value="922s5">922S5</option>
          </select>
          <select value={form.protocol} onChange={(event) => setForm({ ...form, protocol: event.target.value as ProxyProtocol })}>
            <option value="http">HTTP</option>
            <option value="socks5">SOCKS5</option>
          </select>
          <input value={form.host} placeholder="host" onChange={(event) => setForm({ ...form, host: event.target.value })} />
          <input value={form.port} placeholder="port" inputMode="numeric" onChange={(event) => setForm({ ...form, port: event.target.value })} />
          <input value={form.username} placeholder="username" onChange={(event) => setForm({ ...form, username: event.target.value })} />
          <input value={form.password} placeholder="password" type="password" onChange={(event) => setForm({ ...form, password: event.target.value })} />
          <input value={form.country} placeholder="country" onChange={(event) => setForm({ ...form, country: event.target.value })} />
          <input value={form.city} placeholder="city" onChange={(event) => setForm({ ...form, city: event.target.value })} />
          <button className="secondary-button inline" type="submit" disabled={busy}>
            录入
          </button>
          <label className="file-picker compact">
            <span>导入 CSV</span>
            <input type="file" accept=".csv,text/csv" disabled={busy} onChange={handleCsv} />
          </label>
        </form>

        {notice ? <p className="form-notice">{notice}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        {loading ? <p className="summary compact">正在读取代理</p> : null}

        {!loading && proxies.length === 0 ? (
          <p className="summary compact">当前没有代理。</p>
        ) : null}

        {proxies.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>来源</th>
                  <th>地址</th>
                  <th>地区</th>
                  <th>状态</th>
                  <th>店铺</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {proxies.map((proxy) => {
                  const options = availableShops(proxy);
                  return (
                    <tr key={proxy.id}>
                      <td>#{proxy.id}</td>
                      <td>{proxy.provider}</td>
                      <td>
                        {proxy.protocol}://{proxy.host}:{proxy.port}
                        {proxy.hasPassword ? <span className="inline-badge">auth</span> : null}
                      </td>
                      <td>{proxy.city ? `${proxy.country} / ${proxy.city}` : proxy.country}</td>
                      <td>{proxy.status}</td>
                      <td>{proxy.boundShopId ? shopNameById.get(proxy.boundShopId) ?? `#${proxy.boundShopId}` : '未绑定'}</td>
                      <td>
                        <div className="table-actions">
                          <select
                            value={selectedShopByProxy[proxy.id] ?? ''}
                            onChange={(event) => setSelectedShopByProxy({ ...selectedShopByProxy, [proxy.id]: event.target.value })}
                            disabled={busy || proxy.boundShopId !== null || options.length === 0}
                          >
                            <option value="">选择店铺</option>
                            {options.map((shop) => (
                              <option key={shop.id} value={shop.id}>
                                {shop.name}
                              </option>
                            ))}
                          </select>
                          {proxy.boundShopId ? (
                            <button className="secondary-button inline ghost" type="button" disabled={busy} onClick={() => void unbind(proxy)}>
                              解绑
                            </button>
                          ) : (
                            <button className="secondary-button inline" type="button" disabled={busy || options.length === 0} onClick={() => void bind(proxy)}>
                              绑定
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
