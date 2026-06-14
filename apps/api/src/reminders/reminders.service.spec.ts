import { JwtService } from '@nestjs/jwt';
import { RemindersService } from './reminders.service';

describe('RemindersService', () => {
  const makeService = () => {
    const repo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((x) => Promise.resolve(x)),
      create: jest.fn().mockImplementation((x) => x),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const completionRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((x) => Promise.resolve(x)),
      create: jest.fn().mockImplementation((x) => x),
    };
    const jwt = {
      sign: jest.fn().mockReturnValue('tok'),
      verify: jest.fn(),
    } as unknown as JwtService;
    const svc = new RemindersService(
      repo as never,
      completionRepo as never,
      jwt,
    );
    return { svc, repo, completionRepo, jwt };
  };

  describe('complete', () => {
    it('создаёт выполнение для валидного done-токена (идемпотентно)', async () => {
      const { svc, completionRepo, jwt } = makeService();
      (jwt.verify as jest.Mock).mockReturnValue({
        kind: 'done',
        taskId: 't1',
        userId: 'u1',
        occurrenceDate: '2026-06-20',
      });
      completionRepo.findOne.mockResolvedValue(null);

      await svc.complete('tok');

      expect(completionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 't1',
          userId: 'u1',
          date: '2026-06-20',
        }),
      );
    });

    it('не дублирует уже существующее выполнение', async () => {
      const { svc, completionRepo, jwt } = makeService();
      (jwt.verify as jest.Mock).mockReturnValue({
        kind: 'done',
        taskId: 't1',
        userId: 'u1',
        occurrenceDate: '2026-06-20',
      });
      completionRepo.findOne.mockResolvedValue({ id: 'c' });

      await svc.complete('tok');
      expect(completionRepo.save).not.toHaveBeenCalled();
    });

    it('игнорирует невалидный токен', async () => {
      const { svc, completionRepo, jwt } = makeService();
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('bad');
      });
      await svc.complete('tok');
      expect(completionRepo.save).not.toHaveBeenCalled();
    });

    it('игнорирует custom (occurrenceDate "-")', async () => {
      const { svc, completionRepo, jwt } = makeService();
      (jwt.verify as jest.Mock).mockReturnValue({
        kind: 'done',
        taskId: 't1',
        userId: 'u1',
        occurrenceDate: '-',
      });
      await svc.complete('tok');
      expect(completionRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('snooze', () => {
    it('создаёт snooze-копию инстанса с новым fireAt', async () => {
      const { svc, repo, jwt } = makeService();
      (jwt.verify as jest.Mock).mockReturnValue({
        kind: 'snooze',
        instanceId: 'i1',
        userId: 'u1',
      });
      repo.findOne
        .mockResolvedValueOnce({
          // оригинал
          id: 'i1',
          userId: 'u1',
          taskId: 't1',
          ruleId: 'r1',
          occurrenceDate: '2026-06-20',
          linkDate: '2026-06-20',
          title: 'Задача',
          occTime: '09:00',
        })
        .mockResolvedValueOnce(null); // нет существующей копии

      await svc.snooze('tok', 10);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 't1',
          ruleId: 'snooze:r1',
          fired: false,
        }),
      );
    });

    it('не делает ничего при отсутствии инстанса', async () => {
      const { svc, repo, jwt } = makeService();
      (jwt.verify as jest.Mock).mockReturnValue({
        kind: 'snooze',
        instanceId: 'x',
        userId: 'u1',
      });
      repo.findOne.mockResolvedValue(null);
      await svc.snooze('tok', 10);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteForTask', () => {
    it('удаляет инстансы задачи', async () => {
      const { svc, repo } = makeService();
      await svc.deleteForTask('t1');
      expect(repo.delete).toHaveBeenCalledWith({ taskId: 't1' });
    });
  });
});
