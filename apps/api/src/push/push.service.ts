import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PushSubscription } from './entities/push-subscription.entity';

/** Тело web-push сообщения, доставляемое в Service Worker как JSON. */
export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  url?: string;
  snoozeUrl?: string;
  doneUrl?: string;
  snoozeToken?: string;
  doneToken?: string;
  /** id пользователя-инициатора действия — клиент не показывает тост автору. */
  fromUserId?: string;
}

/** Форма подписки, присылаемая фронтом (`PushSubscription.toJSON()`). */
export interface PushSubscriptionJSON {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private enabled = false;

  constructor(
    @InjectRepository(PushSubscription)
    private readonly repo: Repository<PushSubscription>,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject =
      this.config.get<string>('VAPID_SUBJECT') ?? 'mailto:admin@warmingtea.su';
    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.enabled = true;
    } else {
      this.logger.warn(
        'VAPID-ключи не заданы — web-push отключён (напоминания не будут отправляться)',
      );
    }
  }

  getPublicKey(): string {
    return this.config.get<string>('VAPID_PUBLIC_KEY') ?? '';
  }

  /** Сохраняет/обновляет подписку (upsert по endpoint). */
  async subscribe(userId: string, sub: PushSubscriptionJSON): Promise<void> {
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return;
    const existing = await this.repo.findOne({
      where: { endpoint: sub.endpoint },
    });
    if (existing) {
      existing.userId = userId;
      existing.p256dh = sub.keys.p256dh;
      existing.auth = sub.keys.auth;
      await this.repo.save(existing);
      return;
    }
    await this.repo.save(
      this.repo.create({
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      }),
    );
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await this.repo.delete({ endpoint });
  }

  /** Шлёт push на все подписки пользователя; протухшие (404/410) удаляет. */
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.enabled) return;
    const subs = await this.repo.find({ where: { userId } });
    if (!subs.length) return;
    const data = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth },
            },
            data,
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await this.repo.delete({ id: s.id });
          } else {
            this.logger.warn(
              `Не удалось отправить push (${s.endpoint.slice(0, 40)}…): ${String(err)}`,
            );
          }
        }
      }),
    );
  }
}
