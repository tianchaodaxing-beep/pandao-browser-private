import type { WsEvent, WsEventType } from 'shared';

type RegistrySocket = {
  readyState: number;
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
};

const SOCKET_OPEN = 1;
const socketsByUserId = new Map<number, Set<RegistrySocket>>();

export function addWsConnection(userId: number, socket: RegistrySocket) {
  const sockets = socketsByUserId.get(userId) ?? new Set<RegistrySocket>();
  sockets.add(socket);
  socketsByUserId.set(userId, sockets);
}

export function removeWsConnection(userId: number, socket: RegistrySocket) {
  const sockets = socketsByUserId.get(userId);

  if (!sockets) {
    return;
  }

  sockets.delete(socket);
  if (!sockets.size) {
    socketsByUserId.delete(userId);
  }
}

export function buildWsEvent<TPayload extends object>(type: WsEventType, payload: TPayload): WsEvent<TPayload> {
  return {
    type,
    payload,
    ts: new Date().toISOString()
  };
}

export function sendWsEvent<TPayload extends object>(userId: number, type: WsEventType, payload: TPayload) {
  const sockets = socketsByUserId.get(userId);

  if (!sockets?.size) {
    return 0;
  }

  const message = JSON.stringify(buildWsEvent(type, payload));
  let sent = 0;

  for (const socket of sockets) {
    if (socket.readyState !== SOCKET_OPEN) {
      continue;
    }

    socket.send(message);
    sent += 1;
  }

  return sent;
}

export function broadcastWsEvent<TPayload extends object>(type: WsEventType, payload: TPayload) {
  let sent = 0;

  for (const userId of socketsByUserId.keys()) {
    sent += sendWsEvent(userId, type, payload);
  }

  return sent;
}
