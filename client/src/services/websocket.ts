import type { WsEvent } from 'shared';

export type WsConnectionState = 'connecting' | 'open' | 'closed' | 'error';

export type WsUnsubscribe = () => void;

export function connectPandaoWebSocket(
  onEvent: (event: WsEvent) => void,
  onState?: (state: WsConnectionState) => void
): WsUnsubscribe {
  let socket: WebSocket | null = null;
  let stopped = false;
  let retryTimer: number | undefined;

  const setState = (state: WsConnectionState) => {
    onState?.(state);
  };

  const scheduleReconnect = () => {
    if (stopped || retryTimer !== undefined) {
      return;
    }

    retryTimer = window.setTimeout(() => {
      retryTimer = undefined;
      void open();
    }, 3000);
  };

  async function open() {
    setState('connecting');

    try {
      const url = await window.pandao?.ai.wsUrl();
      if (!url || stopped) {
        setState('closed');
        return;
      }

      socket = new WebSocket(url);
      socket.addEventListener('open', () => setState('open'));
      socket.addEventListener('message', (message) => {
        try {
          onEvent(JSON.parse(String(message.data)) as WsEvent);
        } catch {
          // Ignore malformed server messages.
        }
      });
      socket.addEventListener('error', () => setState('error'));
      socket.addEventListener('close', () => {
        setState('closed');
        socket = null;
        scheduleReconnect();
      });
    } catch {
      setState('error');
      scheduleReconnect();
    }
  }

  void open();

  return () => {
    stopped = true;
    if (retryTimer !== undefined) {
      window.clearTimeout(retryTimer);
    }
    socket?.close();
    socket = null;
  };
}
