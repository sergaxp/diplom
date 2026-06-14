import { describe, it, expect } from 'vitest';
import { computeTaskInstances, DEFAULT_ALLDAY_TIME } from './reminders';
import type { Task, ReminderRule } from './tasks';

function mkTask(over: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Задача',
    status: 'pending',
    date: '2026-06-20',
    repeat: 'none',
    type: 'normal',
    ...over,
  };
}

const r = (over: Partial<ReminderRule>): ReminderRule => ({ id: 'r1', type: 'before', ...over });

/** Локальные компоненты момента из ISO-строки (round-trip сохраняет локальное время). */
function parts(iso: string) {
  const d = new Date(iso);
  return { y: d.getFullYear(), mo: d.getMonth() + 1, day: d.getDate(), h: d.getHours(), min: d.getMinutes() };
}

const NOW = new Date('2026-06-14T10:00:00'); // локальное «сейчас» для всех тестов

describe('computeTaskInstances — одиночная задача', () => {
  it('at_time и before дают правильный fireAt', () => {
    const task = mkTask({
      time: '14:00',
      reminders: [r({ id: 'a', type: 'at_time', offsetMinutes: 0 }), r({ id: 'b', type: 'before', offsetMinutes: 60 })],
    });
    const inst = computeTaskInstances(task, { now: NOW });
    expect(inst).toHaveLength(2);

    const at = inst.find(i => i.ruleId === 'a')!;
    expect(at.occurrenceDate).toBe('2026-06-20');
    expect(parts(at.fireAt)).toMatchObject({ day: 20, h: 14, min: 0 });

    const before = inst.find(i => i.ruleId === 'b')!;
    expect(parts(before.fireAt)).toMatchObject({ day: 20, h: 13, min: 0 });
  });

  it('прошедшие fireAt отбрасываются', () => {
    const task = mkTask({
      date: '2026-06-14',
      time: '08:00', // 08:00 < сейчас 10:00 → прошло
      reminders: [r({ id: 'a', type: 'at_time', offsetMinutes: 0 })],
    });
    expect(computeTaskInstances(task, { now: NOW })).toHaveLength(0);
  });

  it('задача без time: «за день/неделю» привязаны к defaultAllDayTime', () => {
    const task = mkTask({
      date: '2026-06-25',
      reminders: [r({ id: 'd', offsetMinutes: 1440 }), r({ id: 'w', offsetMinutes: 10080 })],
    });
    const inst = computeTaskInstances(task, { now: NOW, defaultAllDayTime: '07:30' });
    expect(inst).toHaveLength(2);
    // «за день» → накануне 24-го в 07:30
    expect(parts(inst.find(i => i.ruleId === 'd')!.fireAt)).toMatchObject({ day: 24, h: 7, min: 30 });
    // «за неделю» → 18-го в 07:30
    expect(parts(inst.find(i => i.ruleId === 'w')!.fireAt)).toMatchObject({ day: 18, h: 7, min: 30 });
    // occTime у задачи без времени — null
    expect(inst[0].occTime).toBeNull();
  });

  it('fallback DEFAULT_ALLDAY_TIME при отсутствии профиля', () => {
    const task = mkTask({ reminders: [r({ id: 'd', offsetMinutes: 1440 })] });
    const inst = computeTaskInstances(task, { now: NOW });
    const [hh, mm] = DEFAULT_ALLDAY_TIME.split(':').map(Number);
    expect(parts(inst[0].fireAt)).toMatchObject({ day: 19, h: hh, min: mm });
  });
});

describe('computeTaskInstances — повторы', () => {
  it('daily: offset применён к каждому вхождению горизонта', () => {
    const task = mkTask({
      date: '2026-06-14',
      time: '23:00',
      repeat: 'daily',
      reminders: [r({ id: 'a', type: 'at_time', offsetMinutes: 0 })],
    });
    const inst = computeTaskInstances(task, { now: NOW, horizonDays: 2 });
    // 14,15,16 — все в 23:00 ещё впереди относительно 14-го 10:00
    expect(inst.map(i => i.occurrenceDate).sort()).toEqual(['2026-06-14', '2026-06-15', '2026-06-16']);
    inst.forEach(i => expect(parts(i.fireAt).h).toBe(23));
  });

  it('repeatUntil обрезает горизонт', () => {
    const task = mkTask({
      date: '2026-06-14',
      time: '23:00',
      repeat: 'daily',
      repeatUntil: '2026-06-15',
      reminders: [r({ id: 'a', type: 'at_time', offsetMinutes: 0 })],
    });
    const inst = computeTaskInstances(task, { now: NOW, horizonDays: 10 });
    expect(inst.map(i => i.occurrenceDate).sort()).toEqual(['2026-06-14', '2026-06-15']);
  });

  it('учитывает dayOverrides[day].time', () => {
    const task = mkTask({
      date: '2026-06-14',
      time: '23:00',
      repeat: 'daily',
      dayOverrides: { '2026-06-15': { time: '20:00' } },
      reminders: [r({ id: 'a', type: 'at_time', offsetMinutes: 0 })],
    });
    const inst = computeTaskInstances(task, { now: NOW, horizonDays: 2 });
    const day15 = inst.find(i => i.occurrenceDate === '2026-06-15')!;
    expect(parts(day15.fireAt).h).toBe(20);
    expect(day15.occTime).toBe('20:00');
  });

  it('исключает удалённые дни (dayOverrides.deleted)', () => {
    const task = mkTask({
      date: '2026-06-14',
      time: '23:00',
      repeat: 'daily',
      dayOverrides: { '2026-06-15': { deleted: true } },
      reminders: [r({ id: 'a', type: 'at_time', offsetMinutes: 0 })],
    });
    const inst = computeTaskInstances(task, { now: NOW, horizonDays: 2 });
    expect(inst.map(i => i.occurrenceDate)).not.toContain('2026-06-15');
  });
});

describe('computeTaskInstances — многодневная', () => {
  it('вхождения по дням, «за день» сдвигает каждый', () => {
    const task = mkTask({
      date: '2026-06-18',
      endDate: '2026-06-20',
      reminders: [r({ id: 'd', offsetMinutes: 1440 })],
    });
    const inst = computeTaskInstances(task, { now: NOW, defaultAllDayTime: '09:00' });
    expect(inst.map(i => i.occurrenceDate).sort()).toEqual(['2026-06-18', '2026-06-19', '2026-06-20']);
    const occ18 = inst.find(i => i.occurrenceDate === '2026-06-18')!;
    expect(parts(occ18.fireAt)).toMatchObject({ day: 17, h: 9, min: 0 }); // накануне 09:00
  });
});

describe('computeTaskInstances — custom (абсолютные)', () => {
  it('custom с временем → точный момент, occurrenceDate "-"', () => {
    const task = mkTask({ reminders: [{ id: 'c', type: 'custom', at: '2026-06-25T14:30' }] });
    const inst = computeTaskInstances(task, { now: NOW });
    expect(inst).toHaveLength(1);
    expect(inst[0].occurrenceDate).toBe('-');
    expect(inst[0].linkDate).toBe('2026-06-25');
    expect(parts(inst[0].fireAt)).toMatchObject({ day: 25, h: 14, min: 30 });
  });

  it('custom без времени → defaultAllDayTime', () => {
    const task = mkTask({ reminders: [{ id: 'c', type: 'custom', at: '2026-06-25' }] });
    const inst = computeTaskInstances(task, { now: NOW, defaultAllDayTime: '08:15' });
    expect(parts(inst[0].fireAt)).toMatchObject({ day: 25, h: 8, min: 15 });
  });

  it('custom в прошлом отбрасывается', () => {
    const task = mkTask({ reminders: [{ id: 'c', type: 'custom', at: '2026-06-10T09:00' }] });
    expect(computeTaskInstances(task, { now: NOW })).toHaveLength(0);
  });
});

describe('computeTaskInstances — без правил', () => {
  it('пустой массив при отсутствии reminders', () => {
    expect(computeTaskInstances(mkTask(), { now: NOW })).toEqual([]);
  });
});
