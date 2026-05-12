export type ProxyProvider = 'lunaproxy' | '922s5';

export type ProxyProtocol = 'http' | 'socks5';

export type ProxyStatus = 'active' | 'broken' | 'reserved';

export type ProxyInput = {
  provider: ProxyProvider;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username?: string | null;
  password?: string | null;
  country?: string | null;
  city?: string | null;
};

export type Proxy = {
  id: number;
  provider: ProxyProvider;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username: string | null;
  country: string;
  city: string | null;
  status: ProxyStatus;
  boundShopId: number | null;
  lastCheckAt: string | null;
  createdAt: string;
  hasPassword: boolean;
};

export type ProxyDto = Proxy;

export type ProxyBatchRequest = {
  rows: ProxyInput[];
};

export type ProxyListResponse = {
  proxies: ProxyDto[];
};

export type ProxyBatchResponse = {
  ok: true;
  inserted: ProxyDto[];
};

export type ProxyBindRequest = {
  shopId: number;
};

export type ProxyBindResponse = {
  ok: true;
  proxy: ProxyDto;
};

export type ProxyUnbindResponse = {
  ok: true;
};

export type ShopProxyDto = {
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username: string | null;
  country: string;
  city: string | null;
  hasPassword: boolean;
};

export type ShopProxyResponse = {
  proxy: ShopProxyDto | null;
};

export type ProxyCredentialResponse = {
  username: string | null;
  password: string | null;
};
