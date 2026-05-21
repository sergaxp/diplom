'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '../../components/Header';
import { ManagerCalendar } from '../../components/manager/Calendar';
import { MobileDayStrip } from '../../components/manager/MobileDayStrip';
import { TaskList } from '../../components/manager/TaskList';
import { Task, tasksApi, completionKey, toDateStr } from '../../lib/tasks';
import { Tag, tagsApi } from '../../lib/tags';
import { useAuthStore } from '../../store/authStore';
import { useAchievementStore } from '../../store/achievementStore';
import styles from './page.module.scss';

export default function ManagerPage() {
  const { user, ready } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const pushAchievement = useAchievementStore(s => s.push);

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
    onError: (_, __, ctx) => qc.setQueryData(['tasks'], ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
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

  // ── Handlers ──────────────────────────────────────────────────
  const handleToggle   = (taskId: string, dateStr: string) =>
    toggleMut.mutate({ taskId, date: dateStr });

  const handleDelete   = (id: string) => deleteMut.mutate(id);

  const handleAdd      = (data: Omit<Task, 'id' | 'status'>) => createMut.mutate(data);

  const handleUpdate   = (id: string, data: Omit<Task, 'id' | 'status'>) =>
    updateMut.mutate({ id, data });

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
            onDelete={handleDelete}
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
          />
        </div>
      </div>
    </div>
  );
}
