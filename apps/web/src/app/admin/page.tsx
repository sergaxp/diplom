'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '../../components/Header';
import { useAuthStore } from '../../store/authStore';
import * as LucideIcons from 'lucide-react';
import { adminApi, AdminUser, GlobalTask } from '../../lib/admin';
import { IconPicker } from '../../components/IconPicker';
import styles from './page.module.scss';

type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
const Icons = LucideIcons as unknown as Record<string, LucideIcon>;

// ── Утилиты ────────────────────────────────────────────────────
const ONLINE_MS    = 5  * 60 * 1000;
const RECENTLY_MS  = 30 * 60 * 1000;

function onlineStatus(lastSeenAt: string | null): 'online' | 'recently' | 'offline' {
  if (!lastSeenAt) return 'offline';
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff < ONLINE_MS)   return 'online';
  if (diff < RECENTLY_MS) return 'recently';
  return 'offline';
}

const STATUS_LABEL: Record<string, string> = {
  online:   'В сети',
  recently: 'Недавно',
  offline:  'Не в сети',
};

// ── Setup-форма ────────────────────────────────────────────────
function AdminSetup({ username }: { username: string }) {
  const { setUser } = useAuthStore();
  const [secret, setSecret] = useState('');
  const [error,  setError]  = useState('');
  const [busy,   setBusy]   = useState(false);

  const handlePromote = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const updated = await adminApi.promote(username, secret.trim());
      setUser({ ...updated, email: '', bio: null, coverUrl: null, location: null, locationLat: null, locationLon: null, showGlobalEvents: true, isEmailVerified: false, createdAt: updated.createdAt });
      window.location.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally { setBusy(false); }
  };

  return (
    <div className={styles.setupWrap}>
      <div className={styles.setupCard}>
        <div className={styles.setupIcon}>🔐</div>
        <h2 className={styles.setupTitle}>Настройка администратора</h2>
        <p className={styles.setupDesc}>
          Введите <code>ADMIN_SECRET</code> из <code>.env</code> файла бэкенда.
        </p>
        <form className={styles.setupForm} onSubmit={handlePromote}>
          <input className={styles.setupInput} type="password" value={secret}
            placeholder="Секретный ключ" onChange={e => setSecret(e.target.value)} autoFocus />
          {error && <div className={styles.setupError}>{error}</div>}
          <button className={styles.setupBtn} type="submit" disabled={busy || !secret.trim()}>
            {busy ? 'Выдаю права...' : 'Стать администратором'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Карточка статистики ────────────────────────────────────────
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statValue}>{value.toLocaleString('ru-RU')}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

// ── Строка пользователя ────────────────────────────────────────
function UserRow({ user, isSelf, onToggleRole, onToggleActive }: {
  user: AdminUser; isSelf: boolean;
  onToggleRole: () => void; onToggleActive: () => void;
}) {
  const initial = (user.displayName || user.username)[0].toUpperCase();
  const status  = onlineStatus(user.lastSeenAt);

  return (
    <tr className={[styles.row, !user.isActive ? styles.rowInactive : ''].join(' ')}>
      <td className={styles.tdUser}>
        <div className={styles.userAvatar}>
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt="" className={styles.avatarImg} />
            : <span className={styles.avatarInitial}>{initial}</span>}
        </div>
        <div className={styles.userNames}>
          <span className={styles.username}>@{user.username}</span>
          {user.displayName && <span className={styles.displayName}>{user.displayName}</span>}
        </div>
      </td>
      <td className={styles.tdEmail}>{user.email}</td>
      <td className={styles.tdOnline}>
        <span className={[styles.onlineDot, styles[`dot_${status}`]].join(' ')} />
        <span className={styles.onlineLabel}>{STATUS_LABEL[status]}</span>
      </td>
      <td className={styles.tdRole}>
        <span className={[styles.badge, user.role === 'admin' ? styles.badgeAdmin : styles.badgeUser].join(' ')}>
          {user.role === 'admin' ? 'Админ' : 'Пользователь'}
        </span>
      </td>
      <td className={styles.tdStatus}>
        <span className={[styles.badge, user.isActive ? styles.badgeActive : styles.badgeOff].join(' ')}>
          {user.isActive ? 'Активен' : 'Отключён'}
        </span>
      </td>
      <td className={styles.tdDate}>
        {new Date(user.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
      </td>
      <td className={styles.tdActions}>
        {!isSelf ? (
          <>
            <button className={styles.actionBtn} onClick={onToggleRole}
              title={user.role === 'admin' ? 'Снять права' : 'Сделать админом'}>
              {user.role === 'admin' ? '⬇ Юзер' : '⬆ Админ'}
            </button>
            <button
              className={[styles.actionBtn, user.isActive ? styles.actionBtnDanger : styles.actionBtnSuccess].join(' ')}
              onClick={onToggleActive}>
              {user.isActive ? 'Откл' : 'Вкл'}
            </button>
          </>
        ) : (
          <span className={styles.selfLabel}>Это вы</span>
        )}
      </td>
    </tr>
  );
}

// ── Секция глобальных событий ─────────────────────────────────
const REPEAT_OPTIONS = [
  { value: 'none',    label: 'Без повтора' },
  { value: 'daily',   label: 'Ежедневно' },
  { value: 'weekly',  label: 'Каждую неделю' },
  { value: 'monthly', label: 'Каждый месяц' },
  { value: 'yearly',  label: 'Каждый год' },
];

function GlobalEventsSection() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const [title,  setTitle]  = useState('');
  const [desc,   setDesc]   = useState('');
  const [date,   setDate]   = useState(today);
  const [time,   setTime]   = useState('');
  const [repeat, setRepeat] = useState('none');
  const [icon,   setIcon]   = useState('');
  const [formError, setFormError] = useState('');

  const { data: events = [] } = useQuery({
    queryKey: ['admin', 'events'],
    queryFn: adminApi.getGlobalTasks,
  });

  const createMut = useMutation({
    mutationFn: adminApi.createGlobalTask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'events'] });
      setTitle(''); setDesc(''); setDate(today); setTime(''); setRepeat('none'); setIcon(''); setFormError('');
    },
    onError: () => setFormError('Не удалось создать событие'),
  });

  const deleteMut = useMutation({
    mutationFn: adminApi.deleteGlobalTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'events'] }),
  });

  const handleCreate = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) { setFormError('Заполните название и дату'); return; }
    createMut.mutate({
      title: title.trim(), description: desc.trim() || null,
      date, time: time || null, repeat, repeatUntil: null, icon: icon || null,
    } as Omit<GlobalTask, 'id' | 'createdAt'>);
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Глобальные события</h2>
      <p className={styles.sectionDesc}>Отображаются в менеджере задач у всех пользователей.</p>

      {/* Форма создания */}
      <form className={styles.eventForm} onSubmit={handleCreate}>
        <div className={styles.eventRow}>
          <input className={styles.eventInput} placeholder="Название события *"
            value={title} onChange={e => setTitle(e.target.value)} maxLength={255} />
          <input className={styles.eventInput} placeholder="Описание"
            value={desc} onChange={e => setDesc(e.target.value)} />
        </div>

        {/* Иконка */}
        <div className={styles.iconSection}>
          <span className={styles.iconLabel}>Иконка</span>
          <IconPicker value={icon} onChange={setIcon} />
        </div>

        <div className={styles.eventRow}>
          <input className={styles.eventInput} type="date" value={date}
            onChange={e => setDate(e.target.value)} />
          <input className={styles.eventInput} type="time" value={time}
            onChange={e => setTime(e.target.value)} placeholder="Время" />
          <select className={styles.eventSelect} value={repeat}
            onChange={e => setRepeat(e.target.value)}>
            {REPEAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button className={styles.eventAddBtn} type="submit" disabled={createMut.isPending}>
            {createMut.isPending ? '...' : '+ Добавить'}
          </button>
        </div>
        {formError && <div className={styles.eventError}>{formError}</div>}
      </form>

      {/* Список событий */}
      {events.length === 0
        ? <div className={styles.eventEmpty}>Глобальных событий пока нет</div>
        : (
          <div className={styles.eventList}>
            {events.map(ev => (
              <div key={ev.id} className={styles.eventItem}>
                <div className={styles.eventInfo}>
                  <span className={styles.eventTitle}>
                    {(() => { const Ic = Icons[ev.icon ?? '']; return Ic ? <Ic size={15} strokeWidth={1.75} style={{ verticalAlign: 'middle', marginRight: 5 }} /> : (ev.icon || '🌐'); })()}
                    {ev.title}
                  </span>
                  <span className={styles.eventMeta}>
                    {ev.date}{ev.time ? ` · ${ev.time}` : ''}
                    {ev.repeat !== 'none' ? ` · ${REPEAT_OPTIONS.find(o => o.value === ev.repeat)?.label}` : ''}
                  </span>
                </div>
                <button className={styles.eventDeleteBtn}
                  onClick={() => deleteMut.mutate(ev.id)}
                  disabled={deleteMut.isPending}
                  title="Удалить событие">✕</button>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

// ── Главная страница ───────────────────────────────────────────
export default function AdminPage() {
  const { user, ready } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const searchDebRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (ready && !user) router.replace('/auth');
  }, [ready, user, router]);

  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.getStats,
    enabled: user?.role === 'admin',
    refetchInterval: 30_000,
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin', 'users', debouncedSearch],
    queryFn: () => adminApi.getUsers(debouncedSearch || undefined),
    enabled: user?.role === 'admin',
    refetchInterval: 15_000, // обновляем онлайн-статус каждые 15 сек
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: string; isActive?: boolean } }) =>
      adminApi.updateUser(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });

  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchDebRef.current) clearTimeout(searchDebRef.current);
    searchDebRef.current = setTimeout(() => setDebouncedSearch(val), 400);
  };

  if (!ready || !user) return null;

  if (user.role !== 'admin') {
    return <div className={styles.root}><Header /><AdminSetup username={user.username} /></div>;
  }

  return (
    <div className={styles.root}>
      <Header />
      <div className={styles.body}>
        <h1 className={styles.title}>Панель администратора</h1>

        {/* Статистика */}
        {stats && (
          <div className={styles.stats}>
            <StatCard label="Всего пользователей" value={stats.totalUsers} />
            <StatCard label="Активных"            value={stats.activeUsers} />
            <StatCard label="Задач в системе"     value={stats.totalTasks} />
          </div>
        )}

        {/* Пользователи */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Пользователи</h2>
            <input className={styles.searchInput} type="text"
              placeholder="Поиск по имени или email..."
              value={search} onChange={e => handleSearch(e.target.value)} />
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Пользователь</th>
                  <th className={styles.th}>Email</th>
                  <th className={styles.th}>Онлайн</th>
                  <th className={styles.th}>Роль</th>
                  <th className={styles.th}>Статус</th>
                  <th className={styles.th}>Регистрация</th>
                  <th className={styles.th}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={7} className={styles.loading}>Загрузка...</td></tr>}
                {!isLoading && users.length === 0 && <tr><td colSpan={7} className={styles.loading}>Ничего не найдено</td></tr>}
                {users.map(u => (
                  <UserRow key={u.id} user={u} isSelf={u.id === user.id}
                    onToggleRole={() => updateMut.mutate({ id: u.id, data: { role: u.role === 'admin' ? 'user' : 'admin' } })}
                    onToggleActive={() => updateMut.mutate({ id: u.id, data: { isActive: !u.isActive } })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Глобальные события */}
        <GlobalEventsSection />
      </div>
    </div>
  );
}
