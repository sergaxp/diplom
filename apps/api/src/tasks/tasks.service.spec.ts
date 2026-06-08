import { NotFoundException } from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';
import { TasksService } from './tasks.service';
import { Task, TaskRepeat, TaskType } from './entities/task.entity';
import { TaskCompletion } from './entities/task-completion.entity';
import { GlobalTask } from './entities/global-task.entity';
import { TagsService } from '../tags/tags.service';
import { AchievementsService } from '../achievements/achievements.service';
import { NotificationsService } from '../notifications/notifications.service';

type RepoMock<T extends ObjectLiteral> = jest.Mocked<Repository<T>>;

const repoMock = <T extends ObjectLiteral>(): RepoMock<T> =>
  ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    remove: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(),
  }) as unknown as RepoMock<T>;

describe('TasksService', () => {
  let service: TasksService;
  let taskRepo: RepoMock<Task>;
  let completionRepo: RepoMock<TaskCompletion>;
  let globalTaskRepo: RepoMock<GlobalTask>;
  let tags: jest.Mocked<TagsService>;
  let achievements: jest.Mocked<AchievementsService>;
  let notifications: jest.Mocked<NotificationsService>;

  beforeEach(() => {
    taskRepo = repoMock<Task>();
    completionRepo = repoMock<TaskCompletion>();
    globalTaskRepo = repoMock<GlobalTask>();
    tags = {
      findByIds: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<TagsService>;
    achievements = {
      checkAndUnlock: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<AchievementsService>;
    notifications = {
      create: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<NotificationsService>;

    service = new TasksService(
      taskRepo,
      completionRepo,
      globalTaskRepo,
      tags,
      achievements,
      notifications,
    );
  });

  describe('create', () => {
    const dto = { title: 'Задача', date: '2026-06-08' } as never;

    it('разрешает одинаковые названия (дубликаты не запрещены)', async () => {
      taskRepo.save.mockResolvedValue({
        id: 't1',
        repeat: TaskRepeat.NONE,
        type: TaskType.NORMAL,
        endDate: null,
      } as Task);

      await service.create('u1', dto);
      await service.create('u1', dto);

      expect(taskRepo.save).toHaveBeenCalledTimes(2);
    });

    it('сохраняет задачу и проверяет достижения', async () => {
      taskRepo.save.mockResolvedValue({
        id: 't1',
        repeat: TaskRepeat.NONE,
        type: TaskType.NORMAL,
        endDate: null,
      } as Task);

      const res = await service.create('u1', dto);

      expect(taskRepo.save).toHaveBeenCalled();
      expect(achievements.checkAndUnlock).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ type: 'task_created' }),
      );
      expect(res.task.id).toBe('t1');
      expect(res.newAchievements).toEqual([]);
    });
  });

  describe('update', () => {
    it('бросает NotFound, если задача не найдена', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update('u1', 't1', { title: 'x' } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('обновляет переданные поля и сохраняет', async () => {
      taskRepo.findOne.mockResolvedValue({
        id: 't1',
        title: 'старое',
        tags: [],
      } as unknown as Task);

      const res = await service.update('u1', 't1', { title: 'новое' } as never);

      expect(res.title).toBe('новое');
      expect(taskRepo.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('бросает NotFound, если задача не найдена', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('u1', 't1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('удаляет задачу и её отметки выполнения', async () => {
      const task = { id: 't1' } as Task;
      taskRepo.findOne.mockResolvedValue(task);

      await service.remove('u1', 't1');

      expect(taskRepo.remove).toHaveBeenCalledWith(task);
      expect(completionRepo.delete).toHaveBeenCalledWith({ taskId: 't1' });
    });
  });

  describe('toggleCompletion', () => {
    it('снимает отметку, если она уже есть', async () => {
      const existing = { id: 'c1' } as TaskCompletion;
      completionRepo.findOne.mockResolvedValue(existing);

      const res = await service.toggleCompletion('u1', 't1', '2026-06-08');

      expect(completionRepo.remove).toHaveBeenCalledWith(existing);
      expect(res).toEqual({ done: false, newAchievements: [] });
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('ставит отметку, шлёт уведомление и проверяет достижения', async () => {
      completionRepo.findOne.mockResolvedValue(null);
      taskRepo.findOne.mockResolvedValue({
        id: 't1',
        title: 'Задача',
        description: null,
        time: null,
        type: TaskType.NORMAL,
      } as Task);

      const res = await service.toggleCompletion('u1', 't1', '2026-06-08');

      expect(completionRepo.save).toHaveBeenCalled();
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', kind: 'task_completed' }),
      );
      expect(achievements.checkAndUnlock).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ type: 'task_completed' }),
      );
      expect(res.done).toBe(true);
    });
  });

  describe('getCompletionKeys', () => {
    it('формирует ключи вида taskId__date', async () => {
      completionRepo.find.mockResolvedValue([
        { taskId: 't1', date: '2026-06-08' },
        { taskId: 't2', date: '2026-06-09' },
      ] as TaskCompletion[]);

      const keys = await service.getCompletionKeys('u1');
      expect(keys).toEqual(['t1__2026-06-08', 't2__2026-06-09']);
    });
  });
});
