import { FormEvent, useEffect, useState } from 'react';
import type { ProxyDto, Shop, ShopPlatform } from 'shared';

const platformOptions: { value: ShopPlatform; label: string }[] = [
  { value: 'naver_smartstore', label: 'Naver 智能商店(스마트스토어)' },
  { value: 'coupang', label: 'Coupang(쿠팡)' },
  { value: 'gmarket', label: 'Gmarket(지마켓)' },
  { value: '11st', label: '11번가(十一街)' }
];

const platformLabelMap = platformOptions.reduce<Record<ShopPlatform, string>>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {} as Record<ShopPlatform, string>);

export function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [proxies, setProxies] = useState<ProxyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingShopId, setOpeningShopId] = useState<number | null>(null);
  const [bindingShopId, setBindingShopId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPlatform, setFormPlatform] = useState<ShopPlatform>('naver_smartstore');
  const [formUrl, setFormUrl] = useState('');
  const [formError, setFormError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [shopRes, proxyRes] = await Promise.all([
        window.pandao?.shops.list(),
        window.pandao?.admin.listProxies()
      ]);
      setShops(shopRes?.shops ?? []);
      setProxies(proxyRes?.proxies ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function openShop(shopId: number) {
    setOpeningShopId(shopId);
    setError('');
    try {
      await window.pandao?.shops.open(shopId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '打开店铺失败');
    } finally {
      setOpeningShopId(null);
    }
  }

  async function bindProxy(shopId: number, proxyId: number) {
    setBindingShopId(shopId);
    setError('');
    try {
      await window.pandao?.admin.bindProxy(proxyId, shopId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '绑定代理失败');
    } finally {
      setBindingShopId(null);
    }
  }

  async function unbindProxy(shopId: number, proxyId: number) {
    setBindingShopId(shopId);
    setError('');
    try {
      await window.pandao?.admin.unbindProxy(proxyId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '解绑代理失败');
    } finally {
      setBindingShopId(null);
    }
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const trimmed = formName.trim();
    if (!trimmed) {
      setFormError('请填写店铺名称');
      return;
    }
    setSubmitting(true);
    try {
      const res = await window.pandao?.shops.create({
        name: trimmed,
        platform: formPlatform,
        defaultUrl: formUrl.trim() ? formUrl.trim() : null
      });
      if (res?.shop) {
        setShops((prev) => [...prev, res.shop]);
      }
      setFormName('');
      setFormUrl('');
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '新建店铺失败');
    } finally {
      setSubmitting(false);
    }
  }

  // 可绑定的代理:active 状态、未绑(boundShopId 为 null)或绑给当前店铺
  function availableProxies(currentShopId: number) {
    return proxies.filter((p) => p.status === 'active' && (p.boundShopId === null || p.boundShopId === currentShopId));
  }

  return (
    <section className="panel-stack">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">店铺</p>
            <h2>账号库店铺列表</h2>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="secondary-button inline"
              type="button"
              onClick={() => {
                setShowForm((v) => !v);
                setFormError('');
              }}
            >
              {showForm ? '取消新建' : '新建店铺'}
            </button>
            <button className="secondary-button inline" type="button" onClick={() => void load()}>
              刷新
            </button>
          </div>
        </div>

        {showForm ? (
          <form
            onSubmit={submitCreate}
            style={{
              border: '1px solid #e2e6ef',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: '#fafbfd'
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
              <span>店铺名称(您给这个店起的名字,比如"主力店铺-Naver")</span>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="主力店铺-Naver"
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #c5cad6' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
              <span>平台</span>
              <select
                value={formPlatform}
                onChange={(e) => setFormPlatform(e.target.value as ShopPlatform)}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #c5cad6' }}
              >
                {platformOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
              <span>默认 URL(可选,留空默认进平台首页;不用打 https://)</span>
              <input
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="wing.coupang.com 或 sell.smartstore.naver.com/..."
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #c5cad6' }}
              />
            </label>
            {formError ? <p className="form-error">{formError}</p> : null}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="secondary-button" disabled={submitting}>
                {submitting ? '建店中…' : '确认新建'}
              </button>
              <button type="button" className="secondary-button ghost" onClick={() => setShowForm(false)} disabled={submitting}>
                取消
              </button>
            </div>
            <p className="summary compact" style={{ color: '#6b7280', fontSize: '12px' }}>
              提示:建店后请在卡片上「绑代理」选一条 IP,再点「打开店铺」启动隔离窗口。
            </p>
          </form>
        ) : null}

        {loading ? <p className="summary compact">正在读取店铺与代理</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        {!loading && !error && shops.length === 0 ? (
          <p className="summary compact">还没有店铺。点上方"新建店铺"开始。</p>
        ) : null}
        {shops.length > 0 ? (
          <div className="shop-list">
            {shops.map((shop) => {
              const boundProxy = proxies.find((p) => p.id === shop.proxyId);
              const candidates = availableProxies(shop.id);
              return (
                <article className="shop-card" key={shop.id}>
                  <div className="shop-card-main">
                    <h3>{shop.name}</h3>
                    <p>
                      #{shop.id} · {platformLabelMap[shop.platform] ?? shop.platform}
                      {shop.defaultUrl ? ` · ${shop.defaultUrl}` : ''}
                    </p>
                    <p style={{ fontSize: '12px', color: boundProxy ? '#0a7a3e' : '#b54708', marginTop: '4px' }}>
                      {boundProxy
                        ? `已绑代理 #${boundProxy.id} · ${boundProxy.protocol}://${boundProxy.host}:${boundProxy.port} · ${boundProxy.country}`
                        : '⚠️ 未绑定代理,打开店铺前必须先绑'}
                    </p>
                    <div style={{ marginTop: '6px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {boundProxy ? (
                        <button
                          type="button"
                          className="secondary-button inline"
                          disabled={bindingShopId === shop.id}
                          onClick={() => void unbindProxy(shop.id, boundProxy.id)}
                        >
                          解绑代理
                        </button>
                      ) : (
                        <select
                          disabled={bindingShopId === shop.id || candidates.length === 0}
                          defaultValue=""
                          onChange={(e) => {
                            const pid = Number(e.target.value);
                            if (pid) void bindProxy(shop.id, pid);
                          }}
                          style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #c5cad6', fontSize: '12px' }}
                        >
                          <option value="" disabled>
                            {candidates.length === 0 ? '没有空闲代理' : '选一条代理绑定 ↓'}
                          </option>
                          {candidates.map((p) => (
                            <option key={p.id} value={p.id}>
                              #{p.id} {p.protocol}://{p.host}:{p.port} · {p.country} {p.city ? `(${p.city})` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                  <div className="shop-card-actions">
                    <span>{shop.status === 'active' ? '可用' : '归档'}</span>
                    <button
                      className="shop-open-button"
                      type="button"
                      title={boundProxy ? '在独立窗口打开此店铺' : '请先绑定代理'}
                      disabled={openingShopId === shop.id || !boundProxy}
                      onClick={() => void openShop(shop.id)}
                    >
                      {openingShopId === shop.id ? '打开中' : '打开店铺'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
