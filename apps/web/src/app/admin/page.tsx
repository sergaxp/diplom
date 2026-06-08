'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, X as XIcon, Plus, MessageSquare, Bug } from 'lucide-react';
import { Header } from '../../components/Header';
import { useAuthStore } from '../../store/authStore';
import { adminApi, AdminUser, GlobalTask } from '../../lib/admin';
import { IconPicker } from '../../components/IconPicker';
import { Icon, hasIcon } from '../../lib/icons';
import {
  adminFeedbackApi,
  BugReport, FeatureRequest,
  BugReportStatus, FeatureRequestStatus,
  BUG_STATUS_LABEL, FEATURE_STATUS_LABEL,
} from '../../lib/feedback';
import { Button, IconButton, Input, Badge, Skeleton, EmptyState } from '../../components/ui';
import styles from './page.module.scss';

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

// Дата+время «был в сети» / отправки обращения
function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

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
      setUser({ ...updated, email: '', bio: null, coverUrl: null, location: null, locationLat: null, locationLon: null, showGlobalEvents: true, showHolidays: true, isEmailVerified: false, createdAt: updated.createdAt });
      window.location.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally { setBusy(false); }
  };

  return (
    <div className={styles.setupWrap}>
      <div className={styles.setupCard}>
        <div className={styles.setupIcon}>
          <Lock size={48} strokeWidth={1.25} />
        </div>
        <h2 className={styles.setupTitle}>Настройка администратора</h2>
        <p className={styles.setupDesc}>
          Введите <code>ADMIN_SECRET</code> из <code>.env</code> файла бэкенда.
        </p>
        <form className={styles.setupForm} onSubmit={handlePromote}>
          <Input
            type="password"
            value={secret}
            placeholder="Секретный ключ"
            onChange={e => setSecret(e.target.value)}
            autoFocus
            error={error || undefined}
          />
          <Button
            type="submit"
            variant="accent"
            fullWidth
            loading={busy}
            disabled={!secret.trim()}
          >
            Стать администратором
          </Button>
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
function UserRow({ user, isSelf, onToggleRole, onToggleActive, onDelete }: {
  user: AdminUser; isSelf: boolean;
  onToggleRole: () => void; onToggleActive: () => void; onDelete: () => void;
}) {
  const initial = (user.displayName || user.username)[0].toUpperCase();
  const status  = onlineStatus(user.lastSeenAt);
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <tr className={[styles.row, !user.isActive ? styles.rowInactive : ''].join(' ')}>
      <td className={styles.tdUser}>
        <div className={styles.userAvatar}>
          {user.avatarUrl
            // eslint-disable-next-line @next/next/no-img-element -- аватар из пользовательского upload, оптимизация next/image не нужна
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
        <div className={styles.onlineCell}>
          <div className={styles.onlineStatusRow}>
            <span className={[styles.onlineDot, styles[`dot_${status}`]].join(' ')} aria-hidden="true" />
            <span className={styles.onlineLabel}>{STATUS_LABEL[status]}</span>
          </div>
          {status !== 'online' && user.lastSeenAt && (
            <span className={styles.lastSeenAt} title="Последний раз в сети">
              {formatDateTime(user.lastSeenAt)}
            </span>
          )}
        </div>
      </td>
      <td className={styles.tdRole}>
        <Badge variant={user.role === 'admin' ? 'brand' : 'neutral'} shape="pill">
          {user.role === 'admin' ? 'Админ' : 'Пользователь'}
        </Badge>
      </td>
      <td className={styles.tdStatus}>
        <Badge variant={user.isActive ? 'success' : 'neutral'} shape="pill">
          {user.isActive ? 'Активен' : 'Отключён'}
        </Badge>
      </td>
      <td className={styles.tdDate}>
        {new Date(user.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
      </td>
      <td className={styles.tdActions}>
        {!isSelf ? (
          confirmDel ? (
            <>
              <Button variant="destructive" size="sm" onClick={onDelete}>Удалить навсегда</Button>
              <Button variant="secondary" size="sm" onClick={() => setConfirmDel(false)}>Отмена</Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={onToggleRole}
                title={user.role === 'admin' ? 'Снять права' : 'Сделать админом'}
              >
                {user.role === 'admin' ? '⬇ Юзер' : '⬆ Админ'}
              </Button>
              <Button
                variant={user.isActive ? 'destructive' : 'primary'}
                size="sm"
                onClick={onToggleActive}
              >
                {user.isActive ? 'Откл' : 'Вкл'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={styles.deleteUserBtn}
                onClick={() => setConfirmDel(true)}
                title="Удалить пользователя"
              >
                Удалить
              </Button>
            </>
          )
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

      <form className={styles.eventForm} onSubmit={handleCreate}>
        <div className={styles.eventRow}>
          <Input
            placeholder="Название события *"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={255}
            wrapClassName={styles.eventInputWrap}
          />
          <Input
            placeholder="Описание"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            wrapClassName={styles.eventInputWrap}
          />
        </div>

        <div className={styles.iconSection}>
          <span className={styles.iconLabel}>Иконка</span>
          <IconPicker value={icon} onChange={setIcon} />
        </div>

        <div className={styles.eventRow}>
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            wrapClassName={styles.eventInputWrap}
          />
          <Input
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            placeholder="Время"
            wrapClassName={styles.eventInputWrap}
          />
          <select
            className={styles.eventSelect}
            value={repeat}
            onChange={e => setRepeat(e.target.value)}
          >
            {REPEAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Button
            type="submit"
            variant="accent"
            loading={createMut.isPending}
            leftIcon={<Plus size={16} strokeWidth={2} />}
          >
            Добавить
          </Button>
        </div>
        {formError && <div className={styles.eventError}>{formError}</div>}
      </form>

      {events.length === 0 ? (
        <EmptyState
          size="sm"
          title="Глобальных событий пока нет"
          description="Создайте первое — оно появится у всех пользователей."
        />
      ) : (
        <div className={styles.eventList}>
          {events.map(ev => (
            <div key={ev.id} className={styles.eventItem}>
              <div className={styles.eventInfo}>
                <span className={styles.eventTitle}>
                  {hasIcon(ev.icon)
                    ? <Icon name={ev.icon} size={16} strokeWidth={1.75} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                    : (ev.icon || '🌐')}
                  {ev.title}
                </span>
                <span className={styles.eventMeta}>
                  {ev.date}{ev.time ? ` · ${ev.time}` : ''}
                  {ev.repeat !== 'none' ? ` · ${REPEAT_OPTIONS.find(o => o.value === ev.repeat)?.label}` : ''}
                </span>
              </div>
              <IconButton
                icon={<XIcon size={16} />}
                aria-label="Удалить событие"
                variant="ghost"
                size="sm"
                onClick={() => deleteMut.mutate(ev.id)}
                loading={deleteMut.isPending}
                className={styles.eventDeleteBtn}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Секция обратной связи ──────────────────────────────────────
type FeedbackTab = 'bugs' | 'features';

function AdminFeedbackSection() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<FeedbackTab>('bugs');

  const { data: bugs = [], isLoading: bugsLoading } = useQuery({
    queryKey: ['admin', 'feedback', 'bugs'],
    queryFn: adminFeedbackApi.getAllBugReports,
  });

  const { data: features = [], isLoading: featuresLoading } = useQuery({
    queryKey: ['admin', 'feedback', 'features'],
    queryFn: adminFeedbackApi.getAllFeatureRequests,
  });

  const bugStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BugReportStatus }) =>
      adminFeedbackApi.updateBugStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'feedback', 'bugs'] }),
  });

  const featureStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: FeatureRequestStatus }) =>
      adminFeedbackApi.updateFeatureStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'feedback', 'features'] }),
  });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const renderLoading = () => (
    <div className={styles.feedbackList}>
      {[1, 2, 3].map(i => <Skeleton key={i} width="100%" height={84} />)}
    </div>
  );

  return (
    <div className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Обратная связь</h2>
      </div>

      <div className={styles.feedbackTabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'bugs'}
          className={[styles.feedbackTab, tab === 'bugs' ? styles.feedbackTabActive : ''].join(' ')}
          onClick={() => setTab('bugs')}
        >
          Баги {bugs.length > 0 && <span className={styles.feedbackCount}>{bugs.length}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'features'}
          className={[styles.feedbackTab, tab === 'features' ? styles.feedbackTabActive : ''].join(' ')}
          onClick={() => setTab('features')}
        >
          Нововведения {features.length > 0 && <span className={styles.feedbackCount}>{features.length}</span>}
        </button>
      </div>

      {tab === 'bugs' && (
        bugsLoading ? renderLoading() :
        bugs.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<Bug size={48} strokeWidth={1.25} />}
            title="Баг-репортов нет"
            description="Все спокойно — ничего не сломано."
          />
        ) : (
          <div className={styles.feedbackList}>
            {bugs.map((b: BugReport) => (
              <div key={b.id} className={styles.feedbackItem}>
                <div className={styles.feedbackItemTop}>
                  <div className={styles.feedbackItemMeta}>
                    <span className={styles.feedbackItemUser}>@{b.user?.username ?? '—'}</span>
                    <span className={styles.feedbackItemDate}>{formatDate(b.createdAt)}</span>
                  </div>
                  <select
                    className={styles.feedbackSelect}
                    value={b.status}
                    onChange={e => bugStatusMut.mutate({ id: b.id, status: e.target.value as BugReportStatus })}
                    aria-label="Статус бага"
                  >
                    {(Object.keys(BUG_STATUS_LABEL) as BugReportStatus[]).map(s => (
                      <option key={s} value={s}>{BUG_STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.feedbackItemTitle}>{b.title}</div>
                {b.description && <div className={styles.feedbackItemDesc}>{b.description}</div>}
                {b.attachmentUrls?.length ? (
                  <div className={styles.feedbackAttachments}>
                    {b.attachmentUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className={styles.feedbackAttachLink}>
                        Вложение {i + 1}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'features' && (
        featuresLoading ? renderLoading() :
        features.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<MessageSquare size={48} strokeWidth={1.25} />}
            title="Заявок нет"
            description="Идеи пользователей появятся здесь."
          />
        ) : (
          <div className={styles.feedbackList}>
            {features.map((f: FeatureRequest) => (
              <div key={f.id} className={styles.feedbackItem}>
                <div className={styles.feedbackItemTop}>
                  <div className={styles.feedbackItemMeta}>
                    <span className={styles.feedbackItemUser}>@{f.user?.username ?? '—'}</span>
                    <span className={styles.feedbackItemDate}>{formatDate(f.createdAt)}</span>
                  </div>
                  <select
                    className={styles.feedbackSelect}
                    value={f.status}
                    onChange={e => featureStatusMut.mutate({ id: f.id, status: e.target.value as FeatureRequestStatus })}
                    aria-label="Статус заявки"
                  >
                    {(Object.keys(FEATURE_STATUS_LABEL) as FeatureRequestStatus[]).map(s => (
                      <option key={s} value={s}>{FEATURE_STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.feedbackItemTitle}>{f.title}</div>
                {f.description && <div className={styles.feedbackItemDesc}>{f.description}</div>}
              </div>
            ))}
          </div>
        )
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
    refetchInterval: 15_000,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: string; isActive?: boolean } }) =>
      adminApi.updateUser(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });

  const deleteUserMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
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

        {stats && (
          <div className={styles.stats}>
            <StatCard label="Всего пользователей" value={stats.totalUsers} />
            <StatCard label="Активных"            value={stats.activeUsers} />
            <StatCard label="Задач в системе"     value={stats.totalTasks} />
          </div>
        )}

        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Пользователи</h2>
            <Input
              type="text"
              placeholder="Поиск по имени или email..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              wrapClassName={styles.searchInputWrap}
            />
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
                {isLoading && (
                  <tr><td colSpan={7} className={styles.loading}>
                    <Skeleton width="100%" height={48} />
                  </td></tr>
                )}
                {!isLoading && users.length === 0 && (
                  <tr><td colSpan={7}>
                    <EmptyState size="sm" title="Ничего не найдено" description="Попробуйте другой поиск." />
                  </td></tr>
                )}
                {users.map(u => (
                  <UserRow key={u.id} user={u} isSelf={u.id === user.id}
                    onToggleRole={() => updateMut.mutate({ id: u.id, data: { role: u.role === 'admin' ? 'user' : 'admin' } })}
                    onToggleActive={() => updateMut.mutate({ id: u.id, data: { isActive: !u.isActive } })}
                    onDelete={() => deleteUserMut.mutate(u.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <GlobalEventsSection />

        <AdminFeedbackSection />
      </div>
    </div>
  );
}
