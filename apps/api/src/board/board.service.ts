import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BoardPlacement } from './entities/board-placement.entity';
import { User } from '../users/entities/user.entity';
import {
  BoardColumn,
  DEFAULT_BOARD_COLUMNS,
  MAX_BOARD_COLUMNS,
} from './board.types';
import { SetPlacementDto } from './dto/set-placement.dto';
import { UpdateColumnsDto } from './dto/update-columns.dto';

@Injectable()
export class BoardService {
  constructor(
    @InjectRepository(BoardPlacement)
    private readonly placementRepo: Repository<BoardPlacement>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getState(
    userId: string,
  ): Promise<{ columns: BoardColumn[]; placements: BoardPlacement[] }> {
    const [user, placements] = await Promise.all([
      this.userRepo.findOne({ where: { id: userId } }),
      this.placementRepo.find({ where: { userId } }),
    ]);
    const columns = user?.boardColumns?.length
      ? user.boardColumns
      : DEFAULT_BOARD_COLUMNS;
    return { columns, placements };
  }

  async setColumns(
    userId: string,
    dto: UpdateColumnsDto,
  ): Promise<{ columns: BoardColumn[] }> {
    const cols = dto.columns;
    if (cols.length > MAX_BOARD_COLUMNS) {
      throw new BadRequestException('Слишком много колонок');
    }
    // Должны присутствовать базовые роли ровно по одному разу. Порядок — свободный
    // (колонки переставляются, новые добавляются правее «Завершённые»).
    for (const role of ['todo', 'doing', 'done'] as const) {
      if (cols.filter((c) => c.role === role).length !== 1) {
        throw new BadRequestException(`Колонка роли ${role} должна быть одна`);
      }
    }
    await this.userRepo.update(userId, { boardColumns: cols });
    return { columns: cols };
  }

  /** Upsert позиции карточки (для Начатые/кастомных колонок). */
  async setPlacement(
    userId: string,
    dto: SetPlacementDto,
  ): Promise<BoardPlacement> {
    const existing = await this.placementRepo.findOne({
      where: { userId, cardKey: dto.cardKey, date: dto.date },
    });
    if (existing) {
      existing.columnId = dto.columnId;
      existing.position = dto.position;
      return this.placementRepo.save(existing);
    }
    const created = this.placementRepo.create({ userId, ...dto });
    return this.placementRepo.save(created);
  }

  /** Удалить позицию (возврат карточки в «Не начатые» или уход в «Завершённые»). */
  async removePlacement(
    userId: string,
    cardKey: string,
    date: string,
  ): Promise<void> {
    await this.placementRepo.delete({ userId, cardKey, date });
  }
}
