'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import styles from './LevelUpCelebration.module.scss';

const XP_PER_LEVEL = 1000;
const DISPLAY_MS = 4000;

/**
 * Глобально следит за XP пользователя. При пересечении границы уровня
 * показывает спокойный момент-поздравление. Монтируется один раз в Providers.
 */
export function LevelUpCelebration() {
  const xp = useAuthStore(s => s.user?.xp ?? null);
  const [shownLevel, setShownLevel] = useState<number | null>(null);
  const prevLevel = useRef<number | null>(null);

  useEffect(() => {
    if (xp == null) { prevLevel.current = null; return; }
    const level = Math.floor(xp / XP_PER_LEVEL);
    // Первичная инициализация — без празднования (не показываем при логине)
    if (prevLevel.current == null) {
      prevLevel.current = level;
      return;
    }
    if (level > prevLevel.current) setShownLevel(level);
    prevLevel.current = level;
  }, [xp]);

  useEffect(() => {
    if (shownLevel == null) return;
    const t = setTimeout(() => setShownLevel(null), DISPLAY_MS);
    return () => clearTimeout(t);
  }, [shownLevel]);

  return (
    <AnimatePresence>
      {shownLevel != null && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => setShownLevel(null)}
          role="status"
          aria-live="polite"
        >
          <motion.div
            className={styles.card}
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
          >
            <span className={styles.icon}>
              <Sparkles size={28} strokeWidth={1.75} />
            </span>
            <span className={styles.label}>Новый уровень</span>
            <span className={styles.level}>{shownLevel}</span>
            <p className={styles.text}>Так держать!</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
