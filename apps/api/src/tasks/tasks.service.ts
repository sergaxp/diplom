import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { TaskCompletion } from './entities/task-completion.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(TaskCompletion)
    private readonly completionRepo: Repository<TaskCompletion>,
  ) {}

  findAll(userId: string): Promise<Task[]> {
    return this.taskRepo.find({
      where: { userId },
      order: { date: 'ASC', time: 'ASC' },
    });
  }

  async create(userId: string, dto: CreateTaskDto): Promise<Task> {
    const task = this.taskRepo.create({
      userId,
      title:       dto.title,
      description: dto.description  ?? null,
      date:        dto.date,
      time:        dto.time         ?? null,
      repeat:      dto.repeat       ?? 'none',
      repeatUntil: dto.repeatUntil  ?? null,
      type:        dto.type         ?? 'normal',
    });
    return this.taskRepo.save(task);
  }

  async update(userId: string, id: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.taskRepo.findOne({ where: { id, userId } });
    if (!task) throw new NotFoundException('Задача не найдена');

    if (dto.title       !== undefined) task.title       = dto.title;
    if (dto.description !== undefined) task.description = dto.description ?? null;
    if (dto.date        !== undefined) task.date        = dto.date;
    if (dto.time        !== undefined) task.time        = dto.time ?? null;
    if (dto.repeat      !== undefined) task.repeat      = dto.repeat;
    if (dto.repeatUntil !== undefined) task.repeatUntil = dto.repeatUntil ?? null;
    if (dto.type        !== undefined) task.type        = dto.type;

    return this.taskRepo.save(task);
  }

  async remove(userId: string, id: string): Promise<void> {
    const task = await this.taskRepo.findOne({ where: { id, userId } });
    if (!task) throw new NotFoundException('Задача не найдена');
    await this.taskRepo.remove(task);
    await this.completionRepo.delete({ taskId: id });
  }

  async toggleCompletion(
    userId: string,
    taskId: string,
    date: string,
  ): Promise<{ done: boolean }> {
    const existing = await this.completionRepo.findOne({
      where: { taskId, userId, date },
    });
    if (existing) {
      await this.completionRepo.remove(existing);
      return { done: false };
    }
    await this.completionRepo.save(
      this.completionRepo.create({ taskId, userId, date }),
    );
    return { done: true };
  }

  async getCompletionKeys(userId: string): Promise<string[]> {
    const rows = await this.completionRepo.find({ where: { userId } });
    return rows.map(c => `${c.taskId}__${c.date}`);
  }
}
