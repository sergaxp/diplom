import { Inject, forwardRef, Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { CollabService, CollabEntity } from './collab.service';

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : []),
];

interface JwtPayload {
  sub: string;
  username: string;
}

interface RoomPayload {
  entityType: CollabEntity;
  entityId: string;
}

/** Данные, привязанные к сокету после аутентификации. */
interface SocketData {
  userId?: string;
}

/**
 * Realtime для совместного режима. Комнаты:
 *  - `user:<id>`   — личная, для живых приглашений/уведомлений (бейдж колокольчика);
 *  - `task:<id>` / `project:<id>` — для комментариев, состава участников и правок.
 * Аутентификация — JWT из handshake.auth.token.
 */
@WebSocketGateway({
  namespace: '/collab',
  cors: { origin: allowedOrigins, credentials: true },
})
export class CollabGateway implements OnGatewayConnection {
  private readonly logger = new Logger(CollabGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwt: JwtService,
    @Inject(forwardRef(() => CollabService))
    private readonly collab: CollabService,
  ) {}

  handleConnection(client: Socket): void {
    try {
      const raw =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.headers.authorization ?? '').replace('Bearer ', '');
      const payload = this.jwt.verify<JwtPayload>(raw);
      (client.data as SocketData).userId = payload.sub;
      void client.join(`user:${payload.sub}`);
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RoomPayload,
  ): Promise<{ ok: boolean }> {
    const userId = (client.data as SocketData).userId;
    if (!userId || !payload?.entityId) return { ok: false };
    try {
      if (payload.entityType === 'task') {
        await this.collab.canEditTask(userId, payload.entityId);
      } else {
        await this.collab.canEditProject(userId, payload.entityId);
      }
      void client.join(`${payload.entityType}:${payload.entityId}`);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  @SubscribeMessage('leave')
  onLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RoomPayload,
  ): void {
    if (payload?.entityId) {
      void client.leave(`${payload.entityType}:${payload.entityId}`);
    }
  }

  // ── Server-side emit helpers (вызываются из CollabService/Tasks/Projects) ──
  notifyUser(userId: string): void {
    this.server?.to(`user:${userId}`).emit('notify', {});
  }

  emitMembersChanged(entityType: CollabEntity, entityId: string): void {
    this.server
      ?.to(`${entityType}:${entityId}`)
      .emit('members:changed', { entityType, entityId });
  }

  emitCommentChanged(entityType: CollabEntity, entityId: string): void {
    this.server
      ?.to(`${entityType}:${entityId}`)
      .emit('comment:changed', { entityType, entityId });
  }

  emitEntityChanged(entityType: CollabEntity, entityId: string): void {
    this.server
      ?.to(`${entityType}:${entityId}`)
      .emit('entity:changed', { entityType, entityId });
  }
}
