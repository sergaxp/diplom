import { describe, it, expect } from 'vitest';
import { buildProfilePayload, isProfileDirty, buildManagerPayload } from './payload';
import { ProfileForm, ManagerForm } from './types';

const profileInitial: ProfileForm = { displayName: 'Имя', username: 'user', bio: 'Привет' };

describe('isProfileDirty', () => {
  const cases: { name: string; form: ProfileForm; expected: boolean }[] = [
    { name: 'без изменений', form: { ...profileInitial }, expected: false },
    { name: 'с пробелами по краям — не меняет', form: { ...profileInitial, displayName: '  Имя  ' }, expected: false },
    { name: 'изменено displayName', form: { ...profileInitial, displayName: 'Другое' }, expected: true },
    { name: 'изменено username', form: { ...profileInitial, username: 'other' }, expected: true },
    { name: 'изменено bio', form: { ...profileInitial, bio: 'Другое' }, expected: true },
  ];

  for (const { name, form, expected } of cases) {
    it(name, () => {
      expect(isProfileDirty(form, profileInitial)).toBe(expected);
    });
  }
});

describe('buildProfilePayload', () => {
  it('нет изменений → пустой payload', () => {
    expect(buildProfilePayload({ ...profileInitial }, profileInitial)).toEqual({});
  });

  it('изменено только displayName', () => {
    expect(buildProfilePayload({ ...profileInitial, displayName: 'Новое' }, profileInitial))
      .toEqual({ displayName: 'Новое' });
  });

  it('изменено только username', () => {
    expect(buildProfilePayload({ ...profileInitial, username: 'newuser' }, profileInitial))
      .toEqual({ username: 'newuser' });
  });

  it('изменено только bio', () => {
    expect(buildProfilePayload({ ...profileInitial, bio: 'Новое био' }, profileInitial))
      .toEqual({ bio: 'Новое био' });
  });

  it('значения обрезаются по краям пробелов', () => {
    expect(buildProfilePayload({ ...profileInitial, displayName: '  Новое  ' }, profileInitial))
      .toEqual({ displayName: 'Новое' });
  });

  it('пустая строка превращается в undefined', () => {
    expect(buildProfilePayload({ ...profileInitial, displayName: '   ' }, profileInitial))
      .toEqual({ displayName: undefined });
  });
});

const managerInitial: ManagerForm = {
  location: 'Москва', locationLat: 55.75, locationLon: 37.62,
  showGlobalEvents: true, showHolidays: true,
};

describe('buildManagerPayload', () => {
  it('нет изменений → пустой payload', () => {
    expect(buildManagerPayload({ ...managerInitial }, managerInitial)).toEqual({});
  });

  it('смена локации тянет за собой lat/lon', () => {
    const form: ManagerForm = { ...managerInitial, location: 'Питер', locationLat: 59.93, locationLon: 30.34 };
    expect(buildManagerPayload(form, managerInitial)).toEqual({
      location: 'Питер', locationLat: 59.93, locationLon: 30.34,
    });
  });

  it('очистка локации (lat/lon становятся null) → undefined в payload', () => {
    const form: ManagerForm = { ...managerInitial, location: '', locationLat: null, locationLon: null };
    expect(buildManagerPayload(form, managerInitial)).toEqual({
      location: undefined, locationLat: undefined, locationLon: undefined,
    });
  });

  it('тогл showGlobalEvents', () => {
    const form: ManagerForm = { ...managerInitial, showGlobalEvents: false };
    expect(buildManagerPayload(form, managerInitial)).toEqual({ showGlobalEvents: false });
  });

  it('тогл showHolidays', () => {
    const form: ManagerForm = { ...managerInitial, showHolidays: false };
    expect(buildManagerPayload(form, managerInitial)).toEqual({ showHolidays: false });
  });

  it('оба тогла одновременно', () => {
    const form: ManagerForm = { ...managerInitial, showGlobalEvents: false, showHolidays: false };
    expect(buildManagerPayload(form, managerInitial)).toEqual({ showGlobalEvents: false, showHolidays: false });
  });
});
