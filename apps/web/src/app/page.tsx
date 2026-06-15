'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '../components/Header';
import { Skeleton } from '../components/ui';
import { ManagerCalendar } from '../components/manager/calendar';
import { MobileDayStrip } from '../components/manager/MobileDayStrip';
import { TaskList } from '../components/manager/TaskList';
import { Task, DayOverride, tasksApi, completionKey, toDateStr, isSeriesTask, mergeSeriesSubtasks, prevDayStr } from '../lib/tasks';
import { syncTaskReminders } from '../lib/reminders';
import { DeleteScopeModal } from '../components/manager/DeleteScopeModal';
import { Tag, tagsApi } from '../lib/tags';
import { useAuthStore } from '../store/authStore';
import { useAchievementStore } from '../store/achievementStore';
import { authApi } from '../lib/auth';
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

  // Deep-link из push-уведомления: ?date=YYYY-MM-DD → выбрать день и очистить query
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const param = new URLSearchParams(window.location.search).get('date');
    if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
      const d = new Date(param + 'T00:00:00');
      if (!Number.isNaN(d.getTime())) setSelectedDate(d);
      router.replace('/');
    }
  }, [router]);

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

  // Продление горизонта напоминаний при заходе в менеджер (не чаще раза в сутки).
  useEffect(() => {
    if (!user || !tasks.length) return;
    const KEY = 'wt_reminders_synced_at';
    const today = toDateStr(new Date());
    try {
      if (localStorage.getItem(KEY) === today) return;
      localStorage.setItem(KEY, today);
    } catch { /* ignore */ }
    const withReminders = tasks.filter(t => t.reminders && t.reminders.length);
    if (!withReminders.length) return;
    void Promise.all(
      withReminders.map(t => syncTaskReminders(t, { defaultAllDayTime: user.reminderDefaultTime })),
    );
  }, [user, tasks]);

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
    onSuccess: ({ task, newAchievements }) => {
      // Материализуем напоминания созданной задачи (зная реальный id)
      void syncTaskReminders(task, { defaultAllDayTime: user?.reminderDefaultTime });
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
        // Пересчитываем напоминания после изменения задачи
        void syncTaskReminders(serverTask, { defaultAllDayTime: user?.reminderDefaultTime });
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
  const handleToggle   = (taskId: string, dateStr: string) => {
    if (taskId.startsWith('opt_')) return;
    toggleMut.mutate({ taskId, date: dateStr });
  };

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

  // Снять отметку выполнения для удаляемого(ых) дня(ей), чтобы не оставались
  // «осиротевшие» отметки (искажают достижения/серии и воскресают при восстановлении).
  const clearCompletion = (taskId: string, date: string) => {
    if (completions.has(completionKey(taskId, date))) toggleMut.mutate({ taskId, date });
  };
  const clearCompletionsFrom = (taskId: string, fromDate: string) => {
    const prefix = `${taskId}__`;
    for (const key of completions) {
      if (key.startsWith(prefix) && key.slice(prefix.length) >= fromDate) {
        toggleMut.mutate({ taskId, date: key.slice(prefix.length) });
      }
    }
  };

  const deleteOnlyDay = () => {
    if (!delReq) return;
    const base = tasks.find(t => t.id === delReq.id);
    if (base) {
      const overrides: Record<string, DayOverride> = { ...(base.dayOverrides ?? {}) };
      overrides[delReq.date] = { ...(overrides[delReq.date] ?? {}), deleted: true };
      updateMut.mutate({ id: base.id, data: { ...stripRuntime(base), dayOverrides: overrides } });
      clearCompletion(base.id, delReq.date);
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
        clearCompletionsFrom(base.id, date);
      }
    }
    setDelReq(null);
  };

  const deleteWholeSeries = () => {
    if (delReq) deleteMut.mutate(delReq.id);
    setDelReq(null);
  };

  const handleAdd      = (data: Omit<Task, 'id' | 'status'>) => createMut.mutate(data);

  // Если все подзадачи дня выполнены — отмечаем выполненной и саму задачу.
  const syncCompletionWithSubtasks = (
    taskId: string,
    dateStr: string,
    sections?: Task['subtasks'],
  ) => {
    const items = (sections ?? []).flatMap(s =>
      s.items.filter(i => (i.kind ?? 'subtask') === 'subtask'),
    );
    if (items.length === 0) return;
    const allDone = items.every(i => i.done);
    const isDone  = completions.has(completionKey(taskId, dateStr));
    if (allDone && !isDone) toggleMut.mutate({ taskId, date: dateStr });
  };

  // occDate задан → правка конкретного дня серии. Подзадачи (с их областью «дни»)
  // храним в базовой задаче; в переопределение дня пишем мета-поля и отметки
  // выполненных подзадач именно этого дня (doneIds).
  const handleUpdate   = (id: string, data: Omit<Task, 'id' | 'status'>, occDate?: string) => {
    const base = tasks.find(t => t.id === id);
    if (occDate && base && isSeriesTask(base)) {
      const merged = mergeSeriesSubtasks(base.subtasks, occDate, data.subtasks ?? []);
      const prevOv = base.dayOverrides?.[occDate] ?? {};
      const { subtasks: _legacy, ...prevRest } = prevOv;
      void _legacy;
      const ov: DayOverride = {
        ...prevRest,
        title:       data.title,
        description: data.description,
        time:        data.time,
        endTime:     data.endTime,
        priority:    data.priority,
        icon:        data.icon ?? null,
        doneIds:     merged.doneIds,
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
        subtasks:     merged.subtasks,
        dayOverrides: overrides,
      }});
      syncCompletionWithSubtasks(id, occDate, data.subtasks);
      return;
    }
    // Несерийное обновление: сохраняем переопределения дней, чтобы удалённые
    // дни многодневной задачи не возвращались при правке (payload их не несёт).
    const merged = base?.dayOverrides && data.dayOverrides === undefined
      ? { ...data, dayOverrides: base.dayOverrides }
      : data;
    updateMut.mutate({ id, data: merged });
    syncCompletionWithSubtasks(id, occDate ?? data.date, data.subtasks);
  };

  const handlePostpone = (id: string, days: number) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const shiftDate = (s: string) => {
      const d = new Date(s + 'T00:00:00');
      d.setDate(d.getDate() + days);
      return toDateStr(d);
    };
    // Переопределения дней (удалённые дни, правки, отметки) сдвигаем вместе с задачей,
    // иначе они «отвяжутся» от своих дней (напр. удалённый день воскреснет).
    let shiftedOverrides: Record<string, DayOverride> | null | undefined = task.dayOverrides;
    if (task.dayOverrides) {
      shiftedOverrides = {};
      for (const [k, v] of Object.entries(task.dayOverrides)) shiftedOverrides[shiftDate(k)] = v;
    }
    updateMut.mutate({ id, data: {
      ...stripRuntime(task),
      date:         shiftDate(task.date),
      endDate:      task.endDate ? shiftDate(task.endDate) : undefined,
      dayOverrides: shiftedOverrides,
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
        <div className={styles.body}>
          <div className={styles.left} style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Skeleton text width="45%" height={22} />
            {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} width="100%" height={66} />)}
          </div>
          <div className={styles.right} style={{ padding: 'var(--space-4)' }}>
            <Skeleton width="100%" height={460} />
          </div>
        </div>
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
          />
        </div>
        <div className={styles.right}>
          <ManagerCalendar
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
            tasks={allTasks}
            completions={completions}
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
