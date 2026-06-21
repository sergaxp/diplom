import { create } from 'zustand';

/**
 * Запрос «открыть задачу» из любого места приложения (колокольчик, deep-link).
 * Главная страница менеджера читает request и открывает модалку задачи на
 * нужной вкладке; работает даже когда страница уже смонтирована (в отличие от
 * реактивности на query-параметры в App Router).
 */
interface TaskOpenStore {
  request: { id: string; tab: 'task' | 'discussion' } | null;
  open: (id: string, tab?: 'task' | 'discussion') => void;
  clear: () => void;
}

export const useTaskOpenStore = create<TaskOpenStore>((set) => ({
  request: null,
  open: (id, tab = 'discussion') => set({ request: { id, tab } }),
  clear: () => set({ request: null }),
}));
