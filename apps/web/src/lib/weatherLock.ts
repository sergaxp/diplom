'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Хранилище ключей `${taskId}__${dateStr}` для задач с погодными условиями,
 * которые на момент проверки (для прошедших/сегодняшнего дня) проходили
 * условия. Однажды показанная задача остаётся видимой, даже если прогноз
 * позже стал отрицательным.
 *
 * Хранится в localStorage, монотонно растёт; при загрузке отсекаются
 * записи старше CLEANUP_DAYS.
 */

const STORAGE_KEY = 'wt_weather_shown_lock';
const CLEANUP_DAYS = 365;

function loadLock(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr: string[] = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();

    // Очистка устаревших записей (отсекаем по dateStr < cutoff)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - CLEANUP_DAYS);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    const filtered = arr.filter(k => {
      const idx = k.lastIndexOf('__');
      if (idx < 0) return false;
      const ds = k.slice(idx + 2);
      return ds >= cutoffStr;
    });
    return new Set(filtered);
  } catch {
    return new Set();
  }
}

function saveLock(set: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* localStorage переполнен – игнорируем */
  }
}

/**
 * Хук возвращает Set, который можно передать в `getTasksForDate` через
 * `opts.weatherShownLock`. После каждого рендера, если набор увеличился,
 * новое состояние записывается в localStorage.
 */
export function useWeatherShownLock(): Set<string> {
  const [lock] = useState<Set<string>>(() => loadLock());
  const sizeRef = useRef<number>(lock.size);

  // После каждого рендера: если размер вырос – сохранить
  useEffect(() => {
    if (lock.size !== sizeRef.current) {
      saveLock(lock);
      sizeRef.current = lock.size;
    }
  });

  return lock;
}
