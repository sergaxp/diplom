'use client';

import { useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useReminderToastStore } from '../store/reminderToastStore';
import { useAuthStore } from '../store/authStore';
import { registerServiceWorker } from '../lib/push';
import { primeReminderSound, playReminderSound } from '../lib/reminderSound';
import styles from './ReminderToast.module.scss';

const DISPLAY_MS = 6000;
const ACCENT = '#f59e0b';

/**
 * Глобальный слушатель foreground-напоминаний: Service Worker, увидев push при
 * открытой вкладке, шлёт `postMessage({type:'reminder'})` — здесь играем звук,
 * вибрируем и показываем мягкий тост (системный баннер при этом не дублируется).
 */
export function ReminderToast() {
  const router = useRouter();
  const { queue, push, pop } = useReminderToastStore();
  const meId = useAuthStore((s) => s.user?.id);
  const current = queue[0];
  const currentId = current?.id;

  // Регистрируем SW при загрузке (без запроса разрешения) — чтобы он мог
  // принимать push и пересылать события в открытую вкладку.
  useEffect(() => {
    void registerServiceWorker();
  }, []);

  // Разблокируем звук на первом же взаимодействии пользователя со страницей
  // (autoplay policy): тогда foreground-звук сработает в любой сессии.
  useEffect(() => {
    const prime = () => primeReminderSound();
    window.addEventListener('pointerdown', prime, { once: true });
    window.addEventListener('keydown', prime, { once: true });
    return () => {
      window.removeEventListener('pointerdown', prime);
      window.removeEventListener('keydown', prime);
    };
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type !== 'reminder') return;
      const p = e.data.payload ?? {};
      // Не показываем тост автору собственного действия (комментарий/приглашение).
      if (p.fromUserId && p.fromUserId === meId) return;
      playReminderSound();
      navigator.vibrate?.([200, 100, 200]);
      push({ title: p.title || 'Напоминание', body: p.body || '', url: p.url });
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [push, meId]);

  useEffect(() => {
    if (!currentId) return;
    const t = setTimeout(pop, DISPLAY_MS);
    return () => clearTimeout(t);
  }, [currentId, pop]);

  if (!current) return null;

  const go = () => {
    if (current.url) router.push(current.url);
    pop();
  };

  return (
    <div className={styles.toast} style={{ '--accent': ACCENT } as React.CSSProperties}>
      <button className={styles.main} onClick={go} type="button">
        <span className={styles.iconWrap} style={{ background: ACCENT + '22', color: ACCENT }}>
          <Bell size={20} strokeWidth={1.75} />
        </span>
        <span className={styles.body}>
          <span className={styles.title}>{current.title}</span>
          {current.body && <span className={styles.text}>{current.body}</span>}
        </span>
      </button>
      <button className={styles.close} onClick={pop} aria-label="Закрыть" type="button">✕</button>
    </div>
  );
}
