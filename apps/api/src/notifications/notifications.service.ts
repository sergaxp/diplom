import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Notification, NotificationKind } from './entities/notification.entity';

const MAX_PER_USER = 100; // ограничение, чтобы не разрасталось бесконечно

export interface CreateNotificationPayload {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  icon?: string | null;
  color?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  async create(p: CreateNotificationPayload): Promise<Notification> {
    const n = this.repo.create({
      userId: p.userId,
      kind:   p.kind,
      title:  p.title,
      body:   p.body  ?? null,
      icon:   p.icon  ?? null,
      color:  p.color ?? null,
    });
    const saved = await this.repo.save(n);

    // Подрезаем старые уведомления, если их > MAX_PER_USER
    const count = await this.repo.count({ where: { userId: p.userId } });
    if (count > MAX_PER_USER) {
      const stale = await this.repo.find({
        where: { userId: p.userId },
        order: { createdAt: 'ASC' },
        take: count - MAX_PER_USER,
        select: ['id'],
      });
      if (stale.length) {
        await this.repo.delete({ id: In(stale.map(s => s.id)) });
      }
    }
    return saved;
  }

  async list(userId: string): Promise<Notification[]> {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.repo.count({ where: { userId, read: false } });
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.repo.update({ id, userId }, { read: true });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repo.update({ userId, read: false }, { read: true });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.repo.delete({ id, userId });
  }

  async clearAll(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }
}
