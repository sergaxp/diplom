'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { popLayer } from '../lib/motion';
import { notificationsApi, NotificationItem } from '../lib/notifications';
import { Icon, hasIcon } from '../lib/icons';
import { Button, EmptyState, Skeleton } from './ui';
import styles from './NotificationBell.module.scss';

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)      return 'только что';
  if (diff < 3600)    return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400)   return `${Math.floor(diff / 3600)} ч назад`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} дн назад`;
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { data: unread = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 20_000,
    staleTime: 15_000,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: notificationsApi.list,
    enabled: open,
    staleTime: 5_000,
  });

  const markAllMut = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const removeMut = useMutation({
    mutationFn: notificationsApi.remove,
    onMutate: (id: string) => {
      const prev = qc.getQueryData<NotificationItem[]>(['notifications', 'list']);
      qc.setQueryData<NotificationItem[]>(['notifications', 'list'], (old) => (old ?? []).filter(n => n.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['notifications', 'list'], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] }),
  });

  const clearMut = useMutation({
    mutationFn: notificationsApi.clearAll,
    onSuccess: () => {
      qc.setQueryData(['notifications', 'list'], []);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const handleToggle = () => {
    setOpen(o => {
      const next = !o;
      // При открытии –  помечаем все прочитанными
      if (next && unread > 0) markAllMut.mutate();
      return next;
    });
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.bellBtn}
        onClick={handleToggle}
        aria-label="Уведомления"
        title="Уведомления"
      >
        <Bell size={17} strokeWidth={1.75} />
        {unread > 0 && <span className={styles.badge}>{unread > 9 ? '9+' : unread}</span>}
      </button>

      <AnimatePresence>
        {open && (
        <motion.div
          className={styles.dropdown}
          variants={popLayer}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <div className={styles.head}>
            <span className={styles.title}>Уведомления</span>
            {items.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearMut.mutate()}
                loading={clearMut.isPending}
              >
                Очистить
              </Button>
            )}
          </div>

          <div className={styles.list}>
            {isLoading && (
              <div className={styles.skeletonList}>
                {[1, 2, 3].map(i => <Skeleton key={i} width="100%" height={56} />)}
              </div>
            )}
            {!isLoading && items.length === 0 && (
              <EmptyState
                size="sm"
                icon={<Bell size={36} strokeWidth={1.5} />}
                title="Тишина"
                description="Уведомлений пока нет."
              />
            )}

            {items.map(n => {
              return (
                <div key={n.id} className={[styles.item, !n.read ? styles.itemUnread : ''].join(' ')}>
                  <div
                    className={styles.itemIcon}
                    style={n.color ? { color: n.color, background: n.color + '1f' } : undefined}
                  >
                    {hasIcon(n.icon) ? <Icon name={n.icon} size={16} strokeWidth={1.75} /> : <Bell size={15} strokeWidth={1.75} />}
                  </div>
                  <div className={styles.itemBody}>
                    <span className={styles.itemTitle}>{n.title}</span>
                    {n.body && <span className={styles.itemText}>{n.body}</span>}
                    <span className={styles.itemTime}>{relativeTime(n.createdAt)}</span>
                  </div>
                  <button
                    type="button"
                    className={styles.itemClose}
                    onClick={() => removeMut.mutate(n.id)}
                    aria-label="Скрыть"
                  >×</button>
                </div>
              );
            })}
          </div>
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
