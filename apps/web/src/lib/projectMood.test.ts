import { describe, it, expect } from 'vitest';
import { computeProjectMood, STUCK_DAYS } from './projectMood';
import { Task } from './tasks';

const NOW = new Date('2026-06-17T12:00:00');
const PROJECT = { id: 'p1', deadline: null as string | null };

function ymd(offsetDays: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function iso(offsetDays: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

function mkTask(over: Partial<Task> = {}): Task {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'T',
    status: 'active' as Task['status'],
    repeat: 'none' as Task['repeat'],
    type: 'normal' as Task['type'],
    projectId: 'p1',
    completedAt: null,
    updatedAt: iso(0), // только что тронута → не застряла по умолчанию
    ...over,
  };
}

describe('computeProjectMood', () => {
  it('пустой проект (нет открытых задач) → good', () => {
    const r = computeProjectMood([], PROJECT, NOW);
    expect(r.level).toBe('good');
    expect(r.reason).toBe('Нет активных задач');
  });

  it('все задачи свежие и в срок → good', () => {
    const tasks = [
      mkTask({ date: ymd(3) }),
      mkTask({ date: ymd(5) }),
    ];
    const r = computeProjectMood(tasks, PROJECT, NOW);
    expect(r.level).toBe('good');
    expect(r.signals.overdue).toBe(0);
    expect(r.signals.stuck).toBe(0);
  });

  it('одна просроченная среди нескольких → warn', () => {
    const tasks = [
      mkTask({ date: ymd(-2) }), // просрочена
      mkTask({ date: ymd(4) }),
      mkTask({ date: ymd(5) }),
      mkTask({ date: ymd(6) }),
    ];
    const r = computeProjectMood(tasks, PROJECT, NOW);
    expect(r.level).toBe('warn');
    expect(r.signals.overdue).toBe(1);
  });

  it('застрявшая задача (давно без изменений) считается stuck', () => {
    const tasks = [
      mkTask({ date: ymd(5), updatedAt: iso(-(STUCK_DAYS + 1)) }),
      mkTask({ date: ymd(5) }),
      mkTask({ date: ymd(5) }),
    ];
    const r = computeProjectMood(tasks, PROJECT, NOW);
    expect(r.signals.stuck).toBe(1);
    expect(r.level).toBe('warn');
  });

  it('много просроченных → bad', () => {
    const tasks = Array.from({ length: 6 }, () => mkTask({ date: ymd(-3) }));
    const r = computeProjectMood(tasks, PROJECT, NOW);
    expect(r.level).toBe('bad');
    expect(r.signals.overdue).toBe(6);
  });

  it('высокая доля проблемных задач → bad', () => {
    const tasks = [
      mkTask({ date: ymd(-1) }), // overdue
      mkTask({ date: ymd(-1) }), // overdue
      mkTask({ date: ymd(-1) }), // overdue
      mkTask({ date: ymd(5) }),
    ];
    const r = computeProjectMood(tasks, PROJECT, NOW);
    // badRatio = 0.6*3/4 = 0.45 → bad
    expect(r.level).toBe('bad');
  });

  it('прошедший дедлайн проекта при незавершённости → bad', () => {
    const tasks = [mkTask({ date: ymd(5) })];
    const r = computeProjectMood(tasks, { id: 'p1', deadline: ymd(-1) }, NOW);
    expect(r.level).toBe('bad');
    expect(r.signals.projectOverdue).toBe(true);
  });

  it('задачи чужих проектов игнорируются', () => {
    const tasks = [
      mkTask({ projectId: 'other', date: ymd(-5) }),
      mkTask({ date: ymd(5) }),
    ];
    const r = computeProjectMood(tasks, PROJECT, NOW);
    expect(r.signals.open).toBe(1);
    expect(r.level).toBe('good');
  });

  it('завершённые задачи не считаются открытыми', () => {
    const tasks = [
      mkTask({ date: ymd(-5), completedAt: iso(-1) }),
      mkTask({ date: ymd(5) }),
    ];
    const r = computeProjectMood(tasks, PROJECT, NOW);
    expect(r.signals.open).toBe(1);
    expect(r.signals.overdue).toBe(0);
    expect(r.level).toBe('good');
  });
});
