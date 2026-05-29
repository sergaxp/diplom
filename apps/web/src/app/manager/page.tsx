'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '../../components/Header';
import { ManagerCalendar } from '../../components/manager/Calendar';
import { MobileDayStrip } from '../../components/manager/MobileDayStrip';
import { TaskList } from '../../components/manager/TaskList';
import { Task, DayOverride, tasksApi, completionKey, toDateStr, isSeriesTask, prevDayStr, getTasksForDate } from '../../lib/tasks';
import { DeleteScopeModal } from '../../components/manager/DeleteScopeModal';
import { Tag, tagsApi } from '../../lib/tags';
import { useAuthStore } from '../../store/authStore';
import { useAchievementStore } from '../../store/achievementStore';
import { authApi } from '../../lib/auth';
import styles from './page.module.scss';

export default function ManagerPage() {
  const { user, ready, setUser } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const pushAchievement = useAchievementStore(s => s.push);

  /** Если получены новые достижения – за них начислены монеты, обновляем coins пользователя */
  const refreshUserCoins = async () => {
    const fresh = await authApi.me().catch(() => null);
    if (fresh) setUser(fresh);
  };

  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });
  const [mobileExpanded, setMobileExpanded] = useState(false);

  useEffect(() => {
    if (ready && !user) router.replace('/auth');
  }, [ready, user, router]);

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: tasksApi.getAll,
    enabled: !!user,
    // Длинный интервал + staleTime, чтобы фоновые refetch не перетирали
    // только что отправленные локальные изменения (race condition).
    // Cross-device sync всё ещё работает: ~30с –  комфортный gap.
    refetchInterval: 30_000,
    staleTime: 25_000,
    refetchOnWindowFocus: true,
  });

  const { data: globalEvents = [] } = useQuery({
    queryKey: ['tasks', 'events'],
    queryFn: tasksApi.getGlobalEvents,
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const allTasks = useMemo(
    () => (user?.showGlobalEvents !== false ? [...tasks, ...globalEvents] : tasks),
    [tasks, globalEvents, user?.showGlobalEvents],
  );

  const { data: completionKeys = [] } = useQuery({
    queryKey: ['completions'],
    queryFn: tasksApi.getCompletions,
    enabled: !!user,
  });

  const completions = useMemo(() => new Set(completionKeys), [completionKeys]);

  // ── Optimistic helpers ────────────────────────────────────────
  const cancelAndSnap = async (key: string[]) => {
    await qc.cancelQueries({ queryKey: key });
    return qc.getQueryData<unknown[]>(key);
  };

  // ── Create ────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: tasksApi.create,
    onMutate: async (data) => {
      const prev = await cancelAndSnap(['tasks']);
      const optimistic: Task = { ...data, id: `opt_${Date.now()}`, status: 'pending' };
      qc.setQueryData<Task[]>(['tasks'], old => [...(old ?? []), optimistic]);
      return { prev };
    },
    onSuccess: ({ newAchievements }) => {
      newAchievements.forEach(pushAchievement);
      if (newAchievements.length > 0) {
        qc.invalidateQueries({ queryKey: ['achievements'] });
        if (user) qc.invalidateQueries({ queryKey: ['profile', user.username] });
        refreshUserCoins();
      }
    },
    onError: (_, __, ctx) => qc.setQueryData(['tasks'], ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  // ── Delete ────────────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      // Skip server call for optimistic-only tasks that haven't been persisted yet
      if (id.startsWith('opt_')) return;
      return tasksApi.delete(id);
    },
    onMutate: async (id) => {
      const prev = await cancelAndSnap(['tasks']);
      qc.setQueryData<Task[]>(['tasks'], old => (old ?? []).filter(t => t.id !== id));
      return { prev };
    },
    onError: (_, __, ctx) => qc.setQueryData(['tasks'], ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  // ── Update ────────────────────────────────────────────────────
  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Omit<Task, 'id' | 'status'> }) => {
      // Skip server call for optimistic-only tasks
      if (id.startsWith('opt_')) return undefined as unknown as Task;
      return tasksApi.update(id, data);
    },
    onMutate: async ({ id, data }) => {
      const prev = await cancelAndSnap(['tasks']);
      qc.setQueryData<Task[]>(['tasks'], old =>
        (old ?? []).map(t => t.id !== id ? t : { ...t, ...data }),
      );
      return { prev };
    },
    onSuccess: (serverTask, { id }) => {
      // Сразу применяем серверный ответ –  защищает от race с фоновым refetch
      if (serverTask && id) {
        qc.setQueryData<Task[]>(['tasks'], old =>
          (old ?? []).map(t => t.id === id ? serverTask : t),
        );
      }
    },
    onError: (_, __, ctx) => qc.setQueryData(['tasks'], ctx?.prev),
  });

  // ── Toggle completion ─────────────────────────────────────────
  const toggleMut = useMutation({
    mutationFn: ({ taskId, date }: { taskId: string; date: string }) =>
      tasksApi.toggleCompletion(taskId, date),
    onMutate: async ({ taskId, date }) => {
      const prev = await cancelAndSnap(['completions']);
      const key = completionKey(taskId, date);
      qc.setQueryData<string[]>(['completions'], old => {
        const set = new Set(old ?? []);
        if (set.has(key)) set.delete(key); else set.add(key);
        return [...set];
      });
      return { prev };
    },
    onSuccess: ({ newAchievements }) => {
      newAchievements.forEach(pushAchievement);
      if (newAchievements.length > 0) {
        qc.invalidateQueries({ queryKey: ['achievements'] });
        if (user) qc.invalidateQueries({ queryKey: ['profile', user.username] });
        refreshUserCoins();
      }
    },
    onError: (_, __, ctx) => qc.setQueryData(['completions'], ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['completions'] }),
  });

  // ── Tags ──────────────────────────────────────────────────────
  const { data: userTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsApi.getAll,
    enabled: !!user,
    staleTime: 60_000,
  });

  const createTagMut = useMutation({
    mutationFn: (data: { name: string; color: string; icon?: string | null }) => tagsApi.create(data),
    onMutate: async (newData) => {
      await qc.cancelQueries({ queryKey: ['tags'] });
      const prev = qc.getQueryData<Tag[]>(['tags']) ?? [];
      // Optimistic: add a placeholder so other open modals see the tag
      const optimistic: Tag = { id: `__opt_${Date.now()}`, name: newData.name, color: newData.color, icon: newData.icon ?? null };
      qc.setQueryData(['tags'], [...prev, optimistic]);
      return { prev };
    },
    onError: (_, __, ctx) => {
      if (ctx?.prev) qc.setQueryData(['tags'], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });

  const handleCreateTag = (name: string, color: string, icon?: string | null) =>
    createTagMut.mutateAsync({ name, color, icon });

  // Запрос на удаление дня серии (показываем выбор «только этот / и будущие»)
  const [delReq, setDelReq] = useState<{ id: string; date: string } | null>(null);

  // ── Handlers ──────────────────────────────────────────────────
  const handleToggle   = (taskId: string, dateStr: string) =>
    toggleMut.mutate({ taskId, date: dateStr });

  const stripRuntime = (t: Task): Omit<Task, 'id' | 'status'> => {
    const { id: _i, status: _s, occurrenceDate: _o, weatherWarning: _w, ...rest } = t;
    void _i; void _s; void _o; void _w;
    return rest;
  };

  // Удаление: несерийную задачу убираем сразу, для серии — спрашиваем область
  const requestDelete = (id: string, date: string) => {
    const base = tasks.find(t => t.id === id);
    if (!base || !isSeriesTask(base)) { deleteMut.mutate(id); return; }
    setDelReq({ id, date });
  };

  const deleteOnlyDay = () => {
    if (!delReq) return;
    const base = tasks.find(t => t.id === delReq.id);
    if (base) {
      const overrides: Record<string, DayOverride> = { ...(base.dayOverrides ?? {}) };
      overrides[delReq.date] = { ...(overrides[delReq.date] ?? {}), deleted: true };
      updateMut.mutate({ id: base.id, data: { ...stripRuntime(base), dayOverrides: overrides } });
    }
    setDelReq(null);
  };

  const deleteThisAndFuture = () => {
    if (!delReq) return;
    const base = tasks.find(t => t.id === delReq.id);
    if (base) {
      const { date } = delReq;
      if (date <= base.date) {
        deleteMut.mutate(base.id);           // удаляем всю серию с самого начала
      } else {
        const cutoff = prevDayStr(date);
        const data = stripRuntime(base);
        if (base.endDate && base.endDate >= date) data.endDate = cutoff;   // обрезаем блок
        if (base.repeat && base.repeat !== 'none') data.repeatUntil = cutoff; // стоп повтора
        if (data.dayOverrides) {
          const pruned: Record<string, DayOverride> = {};
          for (const [k, v] of Object.entries(data.dayOverrides)) if (k < date) pruned[k] = v;
          data.dayOverrides = pruned;
        }
        updateMut.mutate({ id: base.id, data });
      }
    }
    setDelReq(null);
  };

  // Проверка уникальности названия в дне (запрет одинаковых названий в одном дне).
  // Возвращает текст ошибки или null. Для многодневной — проверяет каждый день диапазона.
  const validateTitle = (title: string, dateStr: string, endDate?: string, excludeId?: string): string | null => {
    const norm = (s: string) => s.trim().toLowerCase();
    const target = norm(title);
    if (!target) return null;
    const dates: string[] = [];
    if (endDate && endDate > dateStr) {
      const d = new Date(dateStr + 'T00:00:00');
      const end = new Date(endDate + 'T00:00:00');
      while (d <= end) { dates.push(toDateStr(d)); d.setDate(d.getDate() + 1); }
    } else {
      dates.push(dateStr);
    }
    for (const ds of dates) {
      const dayTasks = getTasksForDate(allTasks, new Date(ds + 'T00:00:00'), completions);
      if (dayTasks.some(t => !t.isGlobal && t.id !== excludeId && norm(t.title) === target)) {
        return 'На этот день уже есть задача с таким названием';
      }
    }
    return null;
  };

  const deleteWholeSeries = () => {
    if (delReq) deleteMut.mutate(delReq.id);
    setDelReq(null);
  };

  const handleAdd      = (data: Omit<Task, 'id' | 'status'>) => createMut.mutate(data);

  // occDate задан → правка конкретного дня серии: контент пишем в переопределение дня
  const handleUpdate   = (id: string, data: Omit<Task, 'id' | 'status'>, occDate?: string) => {
    const base = tasks.find(t => t.id === id);
    if (occDate && base && isSeriesTask(base)) {
      const ov: DayOverride = {
        ...(base.dayOverrides?.[occDate] ?? {}),
        title:       data.title,
        description: data.description,
        time:        data.time,
        endTime:     data.endTime,
        priority:    data.priority,
        icon:        data.icon ?? null,
        subtasks:    data.subtasks ?? null,
      };
      const overrides = { ...(base.dayOverrides ?? {}), [occDate]: ov };
      updateMut.mutate({ id, data: {
        ...stripRuntime(base),
        // серийные поля можно менять из редактора дня
        date:         data.date,
        endDate:      data.endDate,
        repeat:       data.repeat,
        repeatConfig: data.repeatConfig,
        repeatUntil:  data.repeatUntil,
        tags:         data.tags,
        dayOverrides: overrides,
      }});
      return;
    }
    updateMut.mutate({ id, data });
  };

  const handlePostpone = (id: string, days: number) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const shiftDate = (s: string) => {
      const d = new Date(s + 'T00:00:00');
      d.setDate(d.getDate() + days);
      return toDateStr(d);
    };
    updateMut.mutate({ id, data: {
      ...task,
      date:    shiftDate(task.date),
      endDate: task.endDate ? shiftDate(task.endDate) : undefined,
    }});
  };

  const goToToday = () => {
    const d = new Date(); d.setHours(0, 0, 0, 0); setSelectedDate(d);
  };

  // ── Guards ────────────────────────────────────────────────────
  if (!ready) {
    return (
      <div className={styles.root}>
        <Header />
        <div className={styles.loading}>Загрузка...</div>
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className={styles.root}>
      <Header />

      {/* Mobile-only top strip (visible only when viewport ≤ 768px) */}
      <div className={styles.mobileTop}>
        <MobileDayStrip
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
          tasks={allTasks}
          expanded={mobileExpanded}
          onToggleExpand={() => setMobileExpanded(v => !v)}
          onGoToToday={goToToday}
        />
      </div>

      <div className={styles.body}>
        <div className={styles.left}>
          <TaskList
            selectedDate={selectedDate}
            tasks={allTasks}
            completions={completions}
            isAdmin={user.role === 'admin'}
            userTags={userTags}
            onCreateTag={handleCreateTag}
            onToggle={handleToggle}
            onDelete={requestDelete}
            onAdd={handleAdd}
            onUpdate={handleUpdate}
            onPostpone={handlePostpone}
            onGoToToday={goToToday}
            validateTitle={validateTitle}
          />
        </div>
        <div className={styles.right}>
          <ManagerCalendar
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
            tasks={allTasks}
          />
        </div>
      </div>

      <DeleteScopeModal
        open={!!delReq}
        taskTitle={delReq ? (tasks.find(t => t.id === delReq.id)?.title ?? '') : ''}
        dayLabel={delReq ? new Date(delReq.date + 'T00:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'long' }) : ''}
        onOnlyThis={deleteOnlyDay}
        onThisAndFuture={deleteThisAndFuture}
        onWholeSeries={deleteWholeSeries}
        onClose={() => setDelReq(null)}
      />
    </div>
  );
}
