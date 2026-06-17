import { io, Socket } from 'socket.io-client';
import { tokens } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

let socket: Socket | null = null;

/**
 * Единый сокет к namespace `/collab`. Лениво подключается при наличии токена.
 * Переиспользуется всеми хуками (комнаты задач/проектов) и глобальным
 * провайдером уведомлений — поэтому один коннект на вкладку.
 */
export function getCollabSocket(): Socket | null {
  if (typeof window === 'undefined') return null;
  const token = tokens.getAccess();
  if (!token) return null;
  if (!socket) {
    socket = io(`${API_URL}/collab`, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
    });
  } else if (!socket.connected) {
    socket.auth = { token };
    socket.connect();
  }
  return socket;
}

export function disconnectCollabSocket(): void {
  socket?.disconnect();
  socket = null;
}
