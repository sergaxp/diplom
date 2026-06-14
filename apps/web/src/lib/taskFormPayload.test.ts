import { describe, it, expect } from 'vitest';
import { buildTaskPayload, TaskFormState } from './taskFormPayload';
import type { Tag } from './tags';

function mkTag(over: Partial<Tag> = {}): Tag {
  return { id: 'tag1', name: 'Work', icon: 'briefcase', color: '#4F46E5', ...over };
}

function mkState(over: Partial<TaskFormState> = {}): TaskFormState {
  return {
    title: 'Buy milk',
    description: '',
    formDate: '2026-06-07',
    multiDay: false,
    endDate: '',
    time: '',
    endTime: '',
    repeat: 'none',
    hasEnd: false,
    repeatUntil: '',
    type: 'normal',
    priority: 'none',
    repeatConfig: null,
    selectedTag: undefined,
    sections: [],
    reminders: [],
    ...over,
  };
}

describe('buildTaskPayload — minimal title', () => {
  it('trims the title and omits empty optional fields', () => {
    const payload = buildTaskPayload(mkState({ title: '  Buy milk  ', description: '   ' }));
    expect(payload.title).toBe('Buy milk');
    expect(payload.description).toBeUndefined();
    expect(payload.endDate).toBeUndefined();
    expect(payload.time).toBeUndefined();
    expect(payload.endTime).toBeUndefined();
    expect(payload.repeatUntil).toBeUndefined();
    expect(payload.icon).toBeNull();
    expect(payload.tags).toEqual([]);
  });
});

describe('buildTaskPayload — multiDay / endDate', () => {
  it('keeps endDate when multiDay and endDate is after formDate', () => {
    const payload = buildTaskPayload(mkState({ multiDay: true, endDate: '2026-06-10' }));
    expect(payload.endDate).toBe('2026-06-10');
  });

  it('drops endDate when multiDay is false', () => {
    const payload = buildTaskPayload(mkState({ multiDay: false, endDate: '2026-06-10' }));
    expect(payload.endDate).toBeUndefined();
  });

  it('drops endDate when it does not come after formDate', () => {
    const payload = buildTaskPayload(mkState({ multiDay: true, endDate: '2026-06-07' }));
    expect(payload.endDate).toBeUndefined();
  });

  it('drops endDate when it is empty', () => {
    const payload = buildTaskPayload(mkState({ multiDay: true, endDate: '' }));
    expect(payload.endDate).toBeUndefined();
  });
});

describe('buildTaskPayload — endTime vs time', () => {
  it('keeps endTime when later than time', () => {
    const payload = buildTaskPayload(mkState({ time: '10:00', endTime: '11:00' }));
    expect(payload.time).toBe('10:00');
    expect(payload.endTime).toBe('11:00');
  });

  it('drops endTime when earlier than time', () => {
    const payload = buildTaskPayload(mkState({ time: '10:00', endTime: '09:00' }));
    expect(payload.endTime).toBeUndefined();
  });

  it('drops endTime when there is no time', () => {
    const payload = buildTaskPayload(mkState({ time: '', endTime: '11:00' }));
    expect(payload.endTime).toBeUndefined();
  });
});

describe('buildTaskPayload — repeat / repeatUntil', () => {
  it('omits repeatUntil for repeat none', () => {
    const payload = buildTaskPayload(mkState({ repeat: 'none', hasEnd: true, repeatUntil: '2026-07-01' }));
    expect(payload.repeatUntil).toBeUndefined();
  });

  it('omits repeatUntil when hasEnd is false', () => {
    const payload = buildTaskPayload(mkState({ repeat: 'daily', hasEnd: false, repeatUntil: '2026-07-01' }));
    expect(payload.repeatUntil).toBeUndefined();
  });

  it('keeps repeatUntil when repeat is set, hasEnd is true and a date is given', () => {
    const payload = buildTaskPayload(mkState({ repeat: 'daily', hasEnd: true, repeatUntil: '2026-07-01' }));
    expect(payload.repeatUntil).toBe('2026-07-01');
  });
});

describe('buildTaskPayload — tag selection', () => {
  it('uses the selected tag and its icon when present', () => {
    const tag = mkTag({ icon: 'star' });
    const payload = buildTaskPayload(mkState({ selectedTag: tag }));
    expect(payload.tags).toEqual([tag]);
    expect(payload.icon).toBe('star');
  });

  it('falls back to null icon and empty tags when no tag is selected', () => {
    const payload = buildTaskPayload(mkState({ selectedTag: undefined }));
    expect(payload.tags).toEqual([]);
    expect(payload.icon).toBeNull();
  });
});
