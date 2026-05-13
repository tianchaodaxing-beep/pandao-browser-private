import { app, net, type Session } from 'electron';
import type {
  ProxyCredentialResponse,
  Shop,
  ShopProxyDto,
  ShopProxyResponse
} from 'shared';
import { requestAuthedJson } from './api-client.js';

type NetFetchInit = RequestInit & {
  session?: Session;
};

const proxyAuthSessions = new WeakMap<Session, number>();
let proxyLoginHandlerInstalled = false;

function buildProxyRules(proxy: ShopProxyDto) {
  if (proxy.protocol === 'socks5') {
    return `socks5://${proxy.host}:${proxy.port}`;
  }

  return `${proxy.host}:${proxy.port}`;
}

async function getShopProxy(shopId: number) {
  const result = await requestAuthedJson<ShopProxyResponse>(`/workspaces/${shopId}/proxy`, {
    method: 'GET'
  });
  return result.proxy;
}

async function getProxyCredential(shopId: number) {
  return requestAuthedJson<ProxyCredentialResponse>(`/workspaces/${shopId}/proxy-credential`, {
    method: 'GET'
  });
}

function installProxyLoginHandler(shopSession: Session, shopId: number) {
  proxyAuthSessions.set(shopSession, shopId);

  if (proxyLoginHandlerInstalled) {
    return;
  }

  app.on('login', (event, webContents, _details, authInfo, callback) => {
    const targetShopId = proxyAuthSessions.get(webContents.session);

    if (!authInfo.isProxy || !targetShopId) {
      callback();
      return;
    }

    event.preventDefault();
    void (async () => {
      let password: string | null = null;

      try {
        const credential = await getProxyCredential(targetShopId);
        password = credential.password;

        if (!credential.username || password === null) {
          callback();
          return;
        }

        callback(credential.username, password);
      } catch {
        callback();
      } finally {
        password = null;
        void password;
      }
    })();
  });

  proxyLoginHandlerInstalled = true;
}

async function verifyProxyNetwork(shopSession: Session) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await net.fetch('http://api.ipify.org', {
      session: shopSession,
      signal: controller.signal
    } as NetFetchInit);

    if (!response.ok) {
      throw new Error(`ipify returned ${response.status}`);
    }

    await response.text();
  } catch {
    throw new Error('代理 IP 检测失败');
  } finally {
    clearTimeout(timeout);
  }
}

export async function applyProxyToSession(shopSession: Session, shop: Shop) {
  if (shop.proxyId === null) {
    return;
  }

  const proxy = await getShopProxy(shop.id);

  if (!proxy) {
    return;
  }

  await shopSession.setProxy({
    proxyRules: buildProxyRules(proxy)
  });
  await shopSession.closeAllConnections();
  installProxyLoginHandler(shopSession, shop.id);
  await verifyProxyNetwork(shopSession);
}
