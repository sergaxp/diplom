import { create } from 'zustand';
import type { AchievementResult } from '../lib/achievements';

interface AchievementStore {
  queue: AchievementResult[];
  push: (a: AchievementResult) => void;
  pop:  () => void;
}

export const useAchievementStore = create<AchievementStore>((set) => ({
  queue: [],
  push: (a) => set(s => ({ queue: [...s.queue, a] })),
  pop:  ()  => set(s => ({ queue: s.queue.slice(1) })),
}));
