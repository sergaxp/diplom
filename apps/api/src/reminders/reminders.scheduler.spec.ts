import { ConfigService } from '@nestjs/config';
import { RemindersScheduler } from './reminders.scheduler';
import { ReminderInstance } from './entities/reminder-instance.entity';

function mkInst(over: Partial<ReminderInstance> = {}): ReminderInstance {
  return {
    id: 'i1',
    userId: 'u1',
    taskId: 't1',
    ruleId: 'r1',
    occurrenceDate: '2026-06-20',
    linkDate: '2026-06-20',
    fireAt: new Date('2026-06-20T09:00:00Z'),
    title: 'Задача',
    occTime: '09:00',
    fired: false,
    createdAt: new Date(),
    ...over,
  };
}

describe('RemindersScheduler.tick', () => {
  const make = (due: ReminderInstance[], completed: Set<string>) => {
    const repo = {
      find: jest.fn().mockResolvedValue(due),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const completionRepo = {
      findOne: jest
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(
            completed.has(`${where.taskId}__${where.date}`)
              ? { id: 'c' }
              : null,
          ),
        ),
    };
    const reminders = {
      signSnoozeToken: jest.fn().mockReturnValue('snooze-tok'),
      signDoneToken: jest.fn().mockReturnValue('done-tok'),
    };
    const push = { sendToUser: jest.fn().mockResolvedValue(undefined) };
    const notifications = { create: jest.fn().mockResolvedValue(undefined) };
    const config = {
      get: jest.fn().mockReturnValue('http://localhost:3001'),
    } as unknown as ConfigService;
    const scheduler = new RemindersScheduler(
      repo as never,
      completionRepo as never,
      reminders as never,
      push as never,
      notifications as never,
      config,
    );
    return { scheduler, repo, completionRepo, push, notifications };
  };

  it('шлёт push и пишет в колокольчик для невыполненного вхождения, помечает fired', async () => {
    const inst = mkInst();
    const { scheduler, repo, push, notifications } = make([inst], new Set());
    await scheduler.tick();

    expect(push.sendToUser).toHaveBeenCalledTimes(1);
    expect(push.sendToUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        title: 'Напоминание',
        body: 'Задача — в 09:00',
        url: '/?date=2026-06-20',
        snoozeUrl: 'http://localhost:3001/reminders/snooze',
        doneUrl: 'http://localhost:3001/reminders/complete',
      }),
    );
    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'reminder' }),
    );
    expect(inst.fired).toBe(true);
    expect(repo.save).toHaveBeenCalledWith([inst]);
  });

  it('не шлёт push для выполненного вхождения, но помечает fired', async () => {
    const inst = mkInst({ occurrenceDate: '2026-06-21' });
    const { scheduler, push, notifications } = make(
      [inst],
      new Set(['t1__2026-06-21']),
    );
    await scheduler.tick();

    expect(push.sendToUser).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
    expect(inst.fired).toBe(true);
  });

  it('custom (occurrenceDate "-") шлётся без проверки выполнения и без doneUrl', async () => {
    const inst = mkInst({
      occurrenceDate: '-',
      occTime: null,
      linkDate: '2026-06-25',
    });
    const { scheduler, push, completionRepo } = make([inst], new Set());
    await scheduler.tick();

    expect(completionRepo.findOne).not.toHaveBeenCalled();
    expect(push.sendToUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        body: 'Задача',
        doneUrl: undefined,
      }),
    );
  });
});
