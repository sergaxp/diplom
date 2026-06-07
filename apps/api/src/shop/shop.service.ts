import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserInventory } from './entities/user-inventory.entity';
import { User } from '../users/entities/user.entity';
import { SHOP_ITEMS, SHOP_ITEM_MAP, ShopItemDef } from './shop.definitions';
import { NotificationsService } from '../notifications/notifications.service';

export interface ShopItemView extends ShopItemDef {
  owned: boolean;
}

@Injectable()
export class ShopService {
  constructor(
    @InjectRepository(UserInventory)
    private readonly invRepo: Repository<UserInventory>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  /** Список товаров с пометкой "owned" для текущего пользователя */
  async getItems(userId: string): Promise<ShopItemView[]> {
    const owned = await this.getInventoryIds(userId);
    return SHOP_ITEMS.map((i) => ({ ...i, owned: owned.has(i.id) }));
  }

  async getInventoryIds(userId: string): Promise<Set<string>> {
    const rows = await this.invRepo.find({ where: { userId } });
    return new Set(rows.map((r) => r.itemId));
  }

  /** Купить товар. Списывает монеты, добавляет в инвентарь и автоматически экипирует рамку. */
  async buy(
    userId: string,
    itemId: string,
  ): Promise<{ user: User; itemId: string }> {
    const item = SHOP_ITEM_MAP.get(itemId);
    if (!item) throw new NotFoundException('Товар не найден');

    return this.dataSource.transaction(async (em) => {
      const user = await em.findOne(User, { where: { id: userId } });
      if (!user) throw new NotFoundException('Пользователь не найден');

      const already = await em.findOne(UserInventory, {
        where: { userId, itemId },
      });
      if (already) throw new ConflictException('Товар уже куплен');

      if (user.coins < item.price) {
        throw new BadRequestException('Недостаточно монет');
      }

      user.coins -= item.price;
      if (item.kind === 'frame') {
        user.selectedFrame = item.id;
      }

      await em.save(user);
      await em.save(em.create(UserInventory, { userId, itemId }));

      // Уведомление о покупке (вне транзакции –  некритично если упадёт)
      await this.notifications
        .create({
          userId,
          kind: 'purchase',
          title: `Куплено: ${item.title}`,
          body: `Списано ${item.price} монет`,
          icon: 'ShoppingBag',
          color: '#a855f7',
        })
        .catch(() => {
          /* ignore */
        });

      return { user, itemId };
    });
  }
}
