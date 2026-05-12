import { useEffect, useState } from 'react';
import type { Shop } from 'shared';

export function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingShopId, setOpeningShopId] = useState<number | null>(null);
  const [error, setError] = useState('');

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

  return (
    <section className="panel-stack">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">店铺</p>
            <h2>账号库店铺列表</h2>
          </div>
          <button className="secondary-button inline" type="button" onClick={() => void load()}>
            刷新
          </button>
        </div>
        {loading ? <p className="summary compact">正在读取店铺</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        {!loading && !error && shops.length === 0 ? (
          <p className="summary compact">当前账号暂无可访问店铺。</p>
        ) : null}
        {shops.length > 0 ? (
          <div className="shop-list">
            {shops.map((shop) => (
              <article className="shop-card" key={shop.id}>
                <div className="shop-card-main">
                  <h3>{shop.name}</h3>
                  <p>
                    #{shop.id} · {shop.platform}
                    {shop.defaultUrl ? ` · ${shop.defaultUrl}` : ''}
                    {shop.proxyId ? ` 路 代理 #${shop.proxyId}` : ' 路 未绑定代理'}
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
