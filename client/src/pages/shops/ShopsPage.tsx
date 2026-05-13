import { FormEvent, useEffect, useState } from 'react';
import type { Shop, ShopPlatform } from 'shared';

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
  const [loading, setLoading] = useState(true);
  const [openingShopId, setOpeningShopId] = useState<number | null>(null);
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
      const result = await window.pandao?.shops.list();
      setShops(result?.shops ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取店铺失败');
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
              <span>默认 URL(可选,留空默认进平台首页)</span>
              <input
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://sell.smartstore.naver.com/..."
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
              提示:建店后请先到"代理 IP"页面绑定一个 IP,然后回这里点"打开店铺"即可启动隔离窗口。账号密码请用主管/老板权限单独录入。
            </p>
          </form>
        ) : null}

        {loading ? <p className="summary compact">正在读取店铺</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        {!loading && !error && shops.length === 0 ? (
          <p className="summary compact">还没有店铺。点上方"新建店铺"开始。</p>
        ) : null}
        {shops.length > 0 ? (
          <div className="shop-list">
            {shops.map((shop) => (
              <article className="shop-card" key={shop.id}>
                <div className="shop-card-main">
                  <h3>{shop.name}</h3>
                  <p>
                    #{shop.id} · {platformLabelMap[shop.platform] ?? shop.platform}
                    {shop.defaultUrl ? ` · ${shop.defaultUrl}` : ''}
                    {shop.proxyId ? ` · 代理 #${shop.proxyId}` : ' · 未绑定代理'}
                  </p>
                </div>
                <div className="shop-card-actions">
                  <span>{shop.status === 'active' ? '可用' : '归档'}</span>
                  <button
                    className="shop-open-button"
                    type="button"
                    title="在独立窗口打开此店铺"
                    disabled={openingShopId === shop.id}
                    onClick={() => void openShop(shop.id)}
                  >
                    {openingShopId === shop.id ? '打开中' : '打开店铺'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
