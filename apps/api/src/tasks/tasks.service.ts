import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Task,
  TaskRepeat,
  TaskType,
  TaskPriority,
} from './entities/task.entity';
import { TaskCompletion } from './entities/task-completion.entity';
import { GlobalTask } from './entities/global-task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TagsService } from '../tags/tags.service';
import {
  AchievementsService,
  AchievementDef,
} from '../achievements/achievements.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RemindersService } from '../reminders/reminders.service';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(TaskCompletion)
    private readonly completionRepo: Repository<TaskCompletion>,
    @InjectRepository(GlobalTask)
    private readonly globalTaskRepo: Repository<GlobalTask>,
    private readonly tagsService: TagsService,
    private readonly achievementsService: AchievementsService,
    private readonly notifications: NotificationsService,
    private readonly reminders: RemindersService,
  ) {}

  findGlobalTasks(): Promise<GlobalTask[]> {
    return this.globalTaskRepo.find({ order: { date: 'ASC' } });
  }

  findAll(userId: string): Promise<Task[]> {
    return this.taskRepo.find({
      where: { userId },
      relations: ['tags'],
      order: { date: 'ASC', time: 'ASC' },
    });
  }

  async create(
    userId: string,
    dto: CreateTaskDto,
  ): Promise<{ task: Task; newAchievements: AchievementDef[] }> {
    const tags = dto.tagIds?.length
      ? await this.tagsService.findByIds(userId, dto.tagIds)
      : [];

    const task = this.taskRepo.create({
      userId,
      title: dto.title,
      description: dto.description ?? null,
      date: dto.date,
      time: dto.time ?? null,
      repeat: dto.repeat ?? TaskRepeat.NONE,
      repeatUntil: dto.repeatUntil ?? null,
      type: dto.type ?? TaskType.NORMAL,
      priority: dto.priority ?? TaskPriority.NONE,
      repeatConfig: dto.repeatConfig ?? null,
      icon: dto.icon ?? null,
      endTime: dto.endTime ?? null,
      endDate: dto.endDate ?? null,
      subtasks: dto.subtasks ?? null,
      reminders: dto.reminders ?? null,
      dayOverrides: dto.dayOverrides ?? null,
      tags,
    });
    const saved = await this.taskRepo.save(task);

    const newAchievements = await this.achievementsService.checkAndUnlock(
      userId,
      {
        type: 'task_created',
        taskRepeat: saved.repeat,
        taskType: saved.type,
        hasEndDate: !!saved.endDate,
      },
    );

    return { task: saved, newAchievements };
  }

  async update(userId: string, id: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id, userId },
      relations: ['tags'],
    });
    if (!task) throw new NotFoundException('Задача не найдена');

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined)
      task.description = dto.description ?? null;
    if (dto.date !== undefined) task.date = dto.date;
    if (dto.time !== undefined) task.time = dto.time ?? null;
    if (dto.repeat !== undefined) task.repeat = dto.repeat;
    if (dto.repeatUntil !== undefined)
      task.repeatUntil = dto.repeatUntil ?? null;
    if (dto.type !== undefined) task.type = dto.type;
    if (dto.priority !== undefined)
      task.priority = dto.priority ?? TaskPriority.NONE;
    if (dto.repeatConfig !== undefined)
      task.repeatConfig = dto.repeatConfig ?? null;
    if (dto.endTime !== undefined) task.endTime = dto.endTime ?? null;
    if (dto.endDate !== undefined) task.endDate = dto.endDate ?? null;

    if (dto.tagIds !== undefined) {
      task.tags = dto.tagIds.length
        ? await this.tagsService.findByIds(userId, dto.tagIds)
        : [];
    }
    if (dto.icon !== undefined) task.icon = dto.icon ?? null;
    if (dto.subtasks !== undefined) task.subtasks = dto.subtasks ?? null;
    if (dto.reminders !== undefined) task.reminders = dto.reminders ?? null;
    if (dto.dayOverrides !== undefined)
      task.dayOverrides = dto.dayOverrides ?? null;

    return this.taskRepo.save(task);
  }

  async remove(userId: string, id: string): Promise<void> {
    const task = await this.taskRepo.findOne({ where: { id, userId } });
    if (!task) throw new NotFoundException('Задача не найдена');
    await this.taskRepo.remove(task);
    await this.completionRepo.delete({ taskId: id });
    await this.reminders.deleteForTask(id);
  }

  async toggleCompletion(
    userId: string,
    taskId: string,
    date: string,
  ): Promise<{ done: boolean; newAchievements: AchievementDef[] }> {
    const existing = await this.completionRepo.findOne({
      where: { taskId, userId, date },
    });

    if (existing) {
      await this.completionRepo.remove(existing);
      return { done: false, newAchievements: [] };
    }

    await this.completionRepo.save(
      this.completionRepo.create({ taskId, userId, date }),
    );

    // Загружаем задачу для контекста достижений и уведомления
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (task) {
      await this.notifications.create({
        userId,
        kind: 'task_completed',
        title: `Задача выполнена: ${task.title}`,
        body: task.description ?? null,
        icon: 'CheckCircle2',
        color: '#22c55e',
      });
    }

    const newAchievements = await this.achievementsService.checkAndUnlock(
      userId,
      {
        type: 'task_completed',
        taskTime: task?.time ?? null,
        taskType: task?.type ?? TaskType.NORMAL,
        hasEndDate: !!task?.endDate,
      },
    );

    return { done: true, newAchievements };
  }

  async getCompletionKeys(userId: string): Promise<string[]> {
    const rows = await this.completionRepo.find({ where: { userId } });
    return rows.map((c) => `${c.taskId}__${c.date}`);
  }
}
