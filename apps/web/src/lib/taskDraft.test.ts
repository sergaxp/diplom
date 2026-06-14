import { describe, it, expect, beforeEach } from 'vitest';
import { Draft, draftKey, isDraftExpired, loadDraft, saveDraft, clearDraft, DRAFT_TTL } from './taskDraft';

function mkStorage() {
  const store = new Map<string, string>();
  return {
    getItem:    (k: string) => store.get(k) ?? null,
    setItem:    (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    _store: store,
  };
}

function mkDraft(over: Partial<Draft> = {}): Draft {
  return {
    title: 'T', description: '', time: '', endTime: '',
    repeat: 'none', hasEnd: false, repeatUntil: '',
    type: 'normal', priority: 'none', tagId: null, multiDay: false, endDate: '',
    sections: [],
    reminders: [],
    savedAt: Date.now(),
    ...over,
  };
}

let storage: ReturnType<typeof mkStorage>;

beforeEach(() => {
  storage = mkStorage();
  globalThis.localStorage = storage as unknown as Storage;
});

describe('draftKey', () => {
  it('namespaces by date string', () => {
    expect(draftKey('2026-06-07')).toBe('wt_draft_2026-06-07');
    expect(draftKey('2026-06-08')).not.toBe(draftKey('2026-06-07'));
  });
});

describe('isDraftExpired', () => {
  it('is false within TTL', () => {
    expect(isDraftExpired(1000, 1000 + DRAFT_TTL - 1)).toBe(false);
  });
  it('is true past TTL', () => {
    expect(isDraftExpired(1000, 1000 + DRAFT_TTL + 1)).toBe(true);
  });
  it('respects a custom ttl', () => {
    expect(isDraftExpired(0, 50, 100)).toBe(false);
    expect(isDraftExpired(0, 150, 100)).toBe(true);
  });
});

describe('saveDraft / loadDraft round-trip', () => {
  it('saves and loads back the same draft', () => {
    const d = mkDraft({ title: 'Hello' });
    saveDraft('2026-06-07', d);
    expect(loadDraft('2026-06-07')).toEqual(d);
  });

  it('isolates drafts by date', () => {
    saveDraft('2026-06-07', mkDraft({ title: 'A' }));
    saveDraft('2026-06-08', mkDraft({ title: 'B' }));
    expect(loadDraft('2026-06-07')?.title).toBe('A');
    expect(loadDraft('2026-06-08')?.title).toBe('B');
  });
});

describe('loadDraft expiry', () => {
  it('returns null and clears the key for an expired draft', () => {
    const d = mkDraft({ savedAt: Date.now() - DRAFT_TTL - 1000 });
    saveDraft('2026-06-07', d);
    expect(loadDraft('2026-06-07')).toBeNull();
    expect(storage._store.has(draftKey('2026-06-07'))).toBe(false);
  });
});

describe('loadDraft malformed data', () => {
  it('returns null for invalid JSON', () => {
    storage.setItem(draftKey('2026-06-07'), '{not json');
    expect(loadDraft('2026-06-07')).toBeNull();
  });

  it('returns null when no draft is stored', () => {
    expect(loadDraft('2026-06-07')).toBeNull();
  });
});

describe('clearDraft', () => {
  it('removes the stored draft', () => {
    saveDraft('2026-06-07', mkDraft());
    clearDraft('2026-06-07');
    expect(loadDraft('2026-06-07')).toBeNull();
  });
});
