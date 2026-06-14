import { create } from 'zustand';

export interface ReminderToastItem {
  id: string;
  title: string;
  body: string;
  url?: string;
}

interface ReminderToastStore {
  queue: ReminderToastItem[];
  push: (t: Omit<ReminderToastItem, 'id'>) => void;
  pop: () => void;
}

export const useReminderToastStore = create<ReminderToastStore>((set) => ({
  queue: [],
  push: (t) =>
    set((s) => ({ queue: [...s.queue, { ...t, id: Math.random().toString(36).slice(2) }] })),
  pop: () => set((s) => ({ queue: s.queue.slice(1) })),
}));
