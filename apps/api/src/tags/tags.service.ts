import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tag } from './entities/tag.entity';
import { CreateTagDto } from './dto/create-tag.dto';
import { AchievementsService } from '../achievements/achievements.service';

const DEFAULT_TAGS = [
  { name: 'Работа',  icon: 'Briefcase', color: '#4F46E5' },
  { name: 'Дом',     icon: 'Home',      color: '#059669' },
  { name: 'Прочее',  icon: 'Tag',       color: '#D97706' },
];

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private readonly tagRepo: Repository<Tag>,
    private readonly achievementsService: AchievementsService,
  ) {}

  async findAll(userId: string): Promise<Tag[]> {
    const existing = await this.tagRepo.find({ where: { userId }, order: { createdAt: 'ASC' } });
    if (existing.length === 0) {
      const defaults = this.tagRepo.create(DEFAULT_TAGS.map(t => ({ ...t, userId })));
      await this.tagRepo.save(defaults);
      return this.tagRepo.find({ where: { userId }, order: { createdAt: 'ASC' } });
    }
    return existing;
  }

  async create(userId: string, dto: CreateTagDto): Promise<Tag> {
    const tag = this.tagRepo.create({
      userId,
      name:  dto.name,
      icon:  dto.icon  ?? null,
      color: dto.color ?? '#6b7280',
    });
    const saved = await this.tagRepo.save(tag);
    await this.achievementsService.checkAndUnlock(userId, { type: 'tag_created' });
    return saved;
  }

  async update(userId: string, id: string, dto: CreateTagDto): Promise<Tag> {
    const tag = await this.tagRepo.findOne({ where: { id } });
    if (!tag) throw new NotFoundException('Тег не найден');
    if (tag.userId !== userId) throw new ForbiddenException();
    if (dto.name  !== undefined) tag.name  = dto.name;
    if (dto.icon  !== undefined) tag.icon  = dto.icon ?? null;
    if (dto.color !== undefined) tag.color = dto.color;
    return this.tagRepo.save(tag);
  }

  async remove(userId: string, id: string): Promise<void> {
    const tag = await this.tagRepo.findOne({ where: { id } });
    if (!tag) throw new NotFoundException('Тег не найден');
    if (tag.userId !== userId) throw new ForbiddenException();
    await this.tagRepo.remove(tag);
  }

  async findByIds(userId: string, ids: string[]): Promise<Tag[]> {
    if (!ids.length) return [];
    const tags = await this.tagRepo.findByIds(ids);
    return tags.filter(t => t.userId === userId);
  }
}
