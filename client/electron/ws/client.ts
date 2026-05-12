import type { EmergencyLockoutWsPayload, WsEvent } from 'shared';

type TokenProvider = () => Promise<string | null>;
type EmergencyLockoutHandler = (payload: EmergencyLockoutWsPayload) => void | Promise<void>;

const reconnectDelays = [1000, 2000, 4000, 8000, 16000, 30000] as const;

function isEmergencyLockoutPayload(value: unknown): value is EmergencyLockoutWsPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Partial<EmergencyLockoutWsPayload>;
  return (
    typeof payload.scope === 'string' &&
    typeof payload.reason === 'string' &&
    typeof payload.ts === 'string' &&
    Array.isArray(payload.affectedUserIds)
  );
}

export function buildWsUrl(apiBaseUrl: string, token: string) {
  const url = new URL(apiBaseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws';
  url.search = '';
  url.searchParams.set('token', token);
  return url.toString();
}

export class EmergencyWsClient {
  private socket: WebSocket | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private stopped = true;
  private retryIndex = 0;

  constructor(
    private readonly apiBaseUrl: string,
    private readonly tokenProvider: TokenProvider,
    private readonly onEmergencyLockout: EmergencyLockoutHandler
  ) {}

  start() {
    if (!this.stopped) {
      return;
    }

    this.stopped = false;
    this.retryIndex = 0;
    this.connectSoon(0);
  }

  reconnectNow() {
    if (this.stopped) {
      this.start();
      return;
    }

    this.closeSocket();
    this.retryIndex = 0;
    this.connectSoon(0);
  }

  stop() {
    this.stopped = true;
    this.clearRetryTimer();
    this.closeSocket();
  }

  private connectSoon(delayMs: number) {
    if (this.stopped || this.retryTimer) {
      return;
    }

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, delayMs);
  }

  private scheduleReconnect() {
    if (this.stopped) {
      return;
    }

    const delay = reconnectDelays[Math.min(this.retryIndex, reconnectDelays.length - 1)];
    this.retryIndex += 1;
    this.connectSoon(delay);
  }

  private async connect() {
    if (this.stopped) {
      return;
    }

    try {
      const token = await this.tokenProvider();
      if (!token) {
        this.scheduleReconnect();
        return;
      }

      const socket = new WebSocket(buildWsUrl(this.apiBaseUrl, token));
      this.socket = socket;

      socket.addEventListener('open', () => {
        this.retryIndex = 0;
      });

      socket.addEventListener('message', (message) => {
        this.handleMessage(message.data);
      });

      socket.addEventListener('close', () => {
        if (this.socket === socket) {
          this.socket = null;
        }
        this.scheduleReconnect();
      });

      socket.addEventListener('error', () => {
        socket.close();
      });
    } catch {
      this.scheduleReconnect();
    }
  }

  private handleMessage(data: unknown) {
    try {
      const event = JSON.parse(String(data)) as WsEvent;
      if (event.type !== 'emergency.lockout' || !isEmergencyLockoutPayload(event.payload)) {
        return;
      }

      this.stop();
      void this.onEmergencyLockout(event.payload);
    } catch {
      // Ignore malformed server messages.
    }
  }

  private clearRetryTimer() {
    if (!this.retryTimer) {
      return;
    }

    clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private closeSocket() {
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }
}
