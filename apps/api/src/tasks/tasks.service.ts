import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  Task,
  TaskRepeat,
  TaskType,
  TaskPriority,
  TaskDifficulty,
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
import { ActivityService } from '../activity/activity.service';
import { CollabService } from '../collab/collab.service';

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
    private readonly activity: ActivityService,
    private readonly collab: CollabService,
  ) {}

  findGlobalTasks(): Promise<GlobalTask[]> {
    return this.globalTaskRepo.find({ order: { date: 'ASC' } });
  }

  async findAll(userId: string): Promise<Task[]> {
    // Доступные задачи = свои + совместные (accepted) + задачи доступных проектов.
    const ids = await this.collab.accessibleTaskIds(userId);
    if (!ids.length) return [];
    const tasks = await this.taskRepo.find({
      where: { id: In(ids) },
      relations: ['tags'],
      order: { date: 'ASC', time: 'ASC' },
    });
    await this.collab.attachTaskCollaborators(tasks);
    return tasks;
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
      date: dto.date ?? null,
      time: dto.time ?? null,
      projectId: dto.projectId ?? null,
      milestoneId: dto.milestoneId ?? null,
      completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
      repeat: dto.repeat ?? TaskRepeat.NONE,
      repeatUntil: dto.repeatUntil ?? null,
      type: dto.type ?? TaskType.NORMAL,
      priority: dto.priority ?? TaskPriority.NONE,
      difficulty: dto.difficulty ?? TaskDifficulty.NORMAL,
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

    await this.activity.log({
      userId,
      projectId: saved.projectId,
      taskId: saved.id,
      type: 'task_created',
      summary: `Создана задача «${saved.title}»`,
    });
    // Задачу создали уже завершённой (импорт/быстрый ввод) — фиксируем и это.
    if (saved.completedAt) {
      await this.activity.log({
        userId,
        projectId: saved.projectId,
        taskId: saved.id,
        type: 'task_completed',
        summary: `Завершена задача «${saved.title}»`,
      });
    }

    const newAchievements = await this.achievementsService.checkAndUnlock(
      userId,
      {
        type: 'task_created',
        taskRepeat: saved.repeat,
        taskType: saved.type,
        hasEndDate: !!saved.endDate,
      },
    );

    // Создатель — владелец; участников пока нет (приглашения добавятся позже).
    (saved as unknown as { ownerId: string }).ownerId = saved.userId;
    (saved as unknown as { collaborators: unknown[] }).collaborators = [];
    return { task: saved, newAchievements };
  }

  async update(userId: string, id: string, dto: UpdateTaskDto): Promise<Task> {
    // Доступ: владелец или принятый участник (задачи/проекта). Бросает Forbidden иначе.
    await this.collab.canEditTask(userId, id);
    const task = await this.taskRepo.findOne({
      where: { id },
      relations: ['tags'],
    });
    if (!task) throw new NotFoundException('Задача не найдена');

    const wasCompleted = task.completedAt != null;

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined)
      task.description = dto.description ?? null;
    if (dto.date !== undefined) task.date = dto.date ?? null;
    if (dto.time !== undefined) task.time = dto.time ?? null;
    if (dto.projectId !== undefined) task.projectId = dto.projectId ?? null;
    if (dto.milestoneId !== undefined)
      task.milestoneId = dto.milestoneId ?? null;
    if (dto.completedAt !== undefined)
      task.completedAt = dto.completedAt ? new Date(dto.completedAt) : null;
    if (dto.repeat !== undefined) task.repeat = dto.repeat;
    if (dto.repeatUntil !== undefined)
      task.repeatUntil = dto.repeatUntil ?? null;
    if (dto.type !== undefined) task.type = dto.type;
    if (dto.priority !== undefined)
      task.priority = dto.priority ?? TaskPriority.NONE;
    if (dto.difficulty !== undefined)
      task.difficulty = dto.difficulty ?? TaskDifficulty.NORMAL;
    if (dto.repeatConfig !== undefined)
      task.repeatConfig = dto.repeatConfig ?? null;
    if (dto.endTime !== undefined) task.endTime = dto.endTime ?? null;
    if (dto.endDate !== undefined) task.endDate = dto.endDate ?? null;

    if (dto.tagIds !== undefined) {
      // Теги совместной задачи резолвим против владельца (теги принадлежат ему).
      task.tags = dto.tagIds.length
        ? await this.tagsService.findByIds(task.userId, dto.tagIds)
        : [];
    }
    if (dto.icon !== undefined) task.icon = dto.icon ?? null;
    if (dto.subtasks !== undefined) task.subtasks = dto.subtasks ?? null;
    if (dto.reminders !== undefined) task.reminders = dto.reminders ?? null;
    if (dto.dayOverrides !== undefined)
      task.dayOverrides = dto.dayOverrides ?? null;

    const saved = await this.taskRepo.save(task);

    // Одно событие на правку: завершение/возврат важнее «отредактировано».
    const isCompleted = saved.completedAt != null;
    if (!wasCompleted && isCompleted) {
      await this.activity.log({
        userId,
        projectId: saved.projectId,
        taskId: saved.id,
        type: 'task_completed',
        summary: `Завершена задача «${saved.title}»`,
      });
    } else if (wasCompleted && !isCompleted) {
      await this.activity.log({
        userId,
        projectId: saved.projectId,
        taskId: saved.id,
        type: 'task_reopened',
        summary: `Возвращена в работу задача «${saved.title}»`,
      });
    } else {
      await this.activity.log({
        userId,
        projectId: saved.projectId,
        taskId: saved.id,
        type: 'task_updated',
        summary: `Изменена задача «${saved.title}»`,
      });
    }

    // Живой инвалидейт для участников, открывших задачу.
    this.collab.emitTaskChanged(saved.id);
    await this.collab.attachTaskCollaborators([saved]);
    return saved;
  }

  async remove(userId: string, id: string): Promise<void> {
    const task = await this.taskRepo.findOne({ where: { id, userId } });
    if (!task) throw new NotFoundException('Задача не найдена');
    await this.taskRepo.remove(task);
    await this.completionRepo.delete({ taskId: id });
    await this.reminders.deleteForTask(id);
    await this.activity.log({
      userId,
      projectId: task.projectId,
      taskId: id,
      type: 'task_deleted',
      summary: `Удалена задача «${task.title}»`,
    });
  }

  async toggleCompletion(
    userId: string,
    taskId: string,
    date: string,
  ): Promise<{ done: boolean; newAchievements: AchievementDef[] }> {
    // Доступ: владелец/участник. Отметка ОБЩАЯ — ключ (taskId, date) без userId.
    await this.collab.canEditTask(userId, taskId);
    const existing = await this.completionRepo.findOne({
      where: { taskId, date },
    });

    if (existing) {
      await this.completionRepo.delete({ taskId, date });
      this.collab.emitTaskChanged(taskId);
      const task = await this.taskRepo.findOne({ where: { id: taskId } });
      if (task) {
        await this.activity.log({
          userId,
          projectId: task.projectId,
          taskId,
          type: 'task_reopened',
          summary: `Возвращена в работу задача «${task.title}»`,
        });
      }
      return { done: false, newAchievements: [] };
    }

    await this.completionRepo.save(
      this.completionRepo.create({ taskId, userId, date }),
    );
    this.collab.emitTaskChanged(taskId);

    // Загружаем задачу для контекста достижений и уведомления
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (task) {
      await this.activity.log({
        userId,
        projectId: task.projectId,
        taskId,
        type: 'task_completed',
        summary: `Завершена задача «${task.title}»`,
      });
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
    // Отметки ОБЩИЕ: возвращаем по всем доступным задачам (свои + совместные),
    // независимо от того, кто из участников поставил галочку.
    const ids = await this.collab.accessibleTaskIds(userId);
    if (!ids.length) return [];
    const rows = await this.completionRepo.find({
      where: { taskId: In(ids) },
    });
    return rows.map((c) => `${c.taskId}__${c.date}`);
  }
}
