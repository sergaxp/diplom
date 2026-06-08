'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { Lock } from 'lucide-react';
import {
  RANK_COLOR,
  RANK_LABEL,
  RANK_COINS,
  type AchievementResult,
} from '../../lib/achievements';
import {
  buildTree,
  NODE_SIZE,
  type TreeNode,
} from '../../lib/achievementTree';
import { Icon, hasIcon } from '../../lib/icons';
import styles from './AchievementTree.module.scss';

const EASE = [0.2, 0, 0, 1] as const;
const MIN_SCALE = 0.4;
const MAX_SCALE = 1.8;
const clampScale = (v: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));

interface Props {
  achievements: AchievementResult[];
}

function touchDistance(a: React.Touch, b: React.Touch): number {
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

export function AchievementTree({ achievements }: Props) {
  const layout = useMemo(() => buildTree(achievements), [achievements]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isPinching, setIsPinching] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  // scale — motionValue, а не React-state: меняем его императивно, без ре-рендера
  // на каждый тик зума (иначе при быстром приближении/отдалении дерево мигало).
  const scale = useMotionValue(1);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  const visibleNodes = layout.nodes.filter((n) => n.visibility !== 'hidden');
  const visibleEdges = layout.edges.filter((e) => e.visible);
  const active = visibleNodes.find((n) => n.ach.id === activeId) ?? null;

  // Границы панорамирования: можно «вынести» в центр любой узел (от крайнего
  // левого до крайнего правого) с небольшим запасом — дальше камера не уезжает.
  const computeBounds = (s: number) => {
    const viewport = viewportRef.current;
    if (!viewport || visibleNodes.length === 0) return null;
    const rect = viewport.getBoundingClientRect();
    const xs = visibleNodes.map((n) => n.x);
    const ys = visibleNodes.map((n) => n.y);
    const M = 140;
    let right = rect.width / 2 - Math.min(...xs) * s + M;
    let left = rect.width / 2 - Math.max(...xs) * s - M;
    let bottom = rect.height / 2 - Math.min(...ys) * s + M;
    let top = rect.height / 2 - Math.max(...ys) * s - M;
    if (left > right) left = right = (left + right) / 2;
    if (top > bottom) top = bottom = (top + bottom) / 2;
    return { left, right, top, bottom };
  };

  const clampToBounds = (s: number) => {
    const b = computeBounds(s);
    if (!b) return;
    x.set(Math.min(b.right, Math.max(b.left, x.get())));
    y.set(Math.min(b.bottom, Math.max(b.top, y.get())));
  };

  // Зум всегда вокруг центра окна просмотра — точка в центре остаётся на месте.
  const zoomTo = (target: number) => {
    const viewport = viewportRef.current;
    const cur = scale.get();
    const next = clampScale(target);
    if (viewport) {
      const rect = viewport.getBoundingClientRect();
      const px = rect.width / 2;
      const py = rect.height / 2;
      const cx = (px - x.get()) / cur;
      const cy = (py - y.get()) / cur;
      x.set(px - cx * next);
      y.set(py - cy * next);
    }
    scale.set(next);
    clampToBounds(next);
  };

  // Корневое достижение всегда в центре окна при открытии дерева.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      const root = layout.nodes.find((n) => n.ach.requires.length === 0);
      if (!viewport || !root) return;
      const rect = viewport.getBoundingClientRect();
      x.set(rect.width / 2 - root.x * scale.get());
      y.set(rect.height / 2 - root.y * scale.get());
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Масштаб колесом мыши (десктоп) — относительно центра окна
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0015);
    zoomTo(scale.get() * factor);
  };

  // Масштаб щипком двух пальцев (мобильные устройства) — тоже от центра окна
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setIsPinching(true);
      pinch.current = {
        dist: touchDistance(e.touches[0], e.touches[1]),
        scale: scale.get(),
      };
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinch.current) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const ratio = touchDistance(a, b) / pinch.current.dist;
      zoomTo(pinch.current.scale * ratio);
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setIsPinching(false);
      pinch.current = null;
    }
  };

  return (
    <div className={styles.root}>
      <div
        className={styles.viewport}
        ref={viewportRef}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <motion.div
          className={styles.canvas}
          drag={!isPinching}
          dragMomentum={false}
          onDrag={() => clampToBounds(scale.get())}
          style={{ width: layout.width, height: layout.height, x, y, scale }}
        >
          {/* Прозрачная «подложка» — расширяет область захвата далеко за пределы
              дерева, чтобы перетаскивать камеру можно было и с пустого фона. */}
          <div className={styles.hitPad} aria-hidden="true" />

          {/* Рёбра — «прорастают» слева направо, соединяя центры узлов прямой
              линией от центра к центру; внутренняя часть скрыта непрозрачным
              кружком узла, поэтому линия визуально исходит точно из центра. */}
          <svg
            className={styles.edges}
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            fill="none"
          >
            <defs>
              {visibleEdges
                .filter((e) => e.active)
                .map((e) => {
                  const parentRank = layout.nodes.find((n) => n.ach.id === e.from)?.ach.rank ?? 1;
                  const childRank = layout.nodes.find((n) => n.ach.id === e.to)?.ach.rank ?? 1;
                  return (
                    <linearGradient
                      key={e.id}
                      id={`ach-edge-${e.id}`}
                      gradientUnits="userSpaceOnUse"
                      x1={e.fromX}
                      y1={e.fromY}
                      x2={e.toX}
                      y2={e.toY}
                    >
                      <stop offset="0" stopColor={RANK_COLOR[parentRank]} />
                      <stop offset="1" stopColor={RANK_COLOR[childRank]} />
                    </linearGradient>
                  );
                })}
            </defs>

            {visibleEdges.map((e) => {
              // Прямая от центра к центру — внутренние части прячутся под
              // непрозрачными кружками узлов (они выше по z-index).
              const d = `M ${e.fromX} ${e.fromY} L ${e.toX} ${e.toY}`;
              const stroke = e.active ? `url(#ach-edge-${e.id})` : 'var(--border-default)';
              return (
                <motion.path
                  key={e.id}
                  d={d}
                  stroke={stroke}
                  strokeWidth={e.active ? 2.5 : 1.5}
                  strokeLinecap="round"
                  strokeDasharray={e.active ? undefined : '4 6'}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: e.active ? 0.9 : 0.45 }}
                  transition={{
                    duration: 0.6,
                    ease: EASE,
                    delay: 0.15 + e.column * 0.12,
                  }}
                />
              );
            })}
          </svg>

          {/* Узлы — открытые и «граница» (туман войны скрывает остальное) */}
          {visibleNodes.map((node) => (
            <TreeNodeView
              key={node.ach.id}
              node={node}
              isActive={node.ach.id === activeId}
              onSelect={() =>
                setActiveId((id) => (id === node.ach.id ? null : node.ach.id))
              }
            />
          ))}
        </motion.div>

        {/* Карточка деталей выбранного узла (только для открытых и границы) */}
        {active && active.visibility !== 'locked' && !active.isSecret && (
          <motion.div
            key={active.ach.id}
            className={styles.detail}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            style={{
              ['--rank' as string]: RANK_COLOR[active.ach.rank],
            }}
          >
            <div className={styles.detailHead}>
              <span className={styles.detailTitle}>{active.ach.title}</span>
              <span className={styles.detailRank}>
                {RANK_LABEL[active.ach.rank]}
              </span>
            </div>
            <p className={styles.detailDesc}>{active.ach.description}</p>
            <div className={styles.detailMeta}>
              <span>+{active.ach.xp} XP</span>
              <span>+{RANK_COINS[active.ach.rank]} монет</span>
              <span
                className={
                  active.ach.unlocked ? styles.statusDone : styles.statusLocked
                }
              >
                {active.ach.unlocked
                  ? active.ach.unlockedAt
                    ? `Открыто ${new Date(active.ach.unlockedAt).toLocaleDateString('ru-RU')}`
                    : 'Открыто'
                  : 'Не открыто'}
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function TreeNodeView({
  node,
  isActive,
  onSelect,
}: {
  node: TreeNode;
  isActive: boolean;
  onSelect: () => void;
}) {
  const { ach, x, y, visibility, isSecret } = node;
  const color = RANK_COLOR[ach.rank];
  const isUnlocked = visibility === 'unlocked';
  // «locked» — лишь индикатор «дальше есть ещё»: без названия, без описания,
  // не кликается (просто замок).
  const isLocked = visibility === 'locked';

  return (
    <motion.button
      type="button"
      className={[
        styles.node,
        styles[`node--${visibility}`],
        isActive ? styles.nodeActive : '',
      ].join(' ')}
      // Позиционируем по левому-верхнему углу (центр узла = x,y), а НЕ через
      // CSS-transform: framer-motion перезаписывает transform масштабом и сбил бы
      // центрирование — из-за этого кружки «съезжали» вниз-вправо.
      style={{
        left: x - NODE_SIZE / 2,
        top: y - NODE_SIZE / 2,
        width: NODE_SIZE,
        height: NODE_SIZE,
        ['--rank' as string]: color,
      }}
      onClick={isLocked ? undefined : onSelect}
      disabled={isLocked}
      variants={{
        hidden: { opacity: 0, scale: 0.6 },
        shown: {
          opacity: 1,
          scale: 1,
          // Появление со stagger по глубине — задержка только здесь, чтобы
          // ховер/нажатие срабатывали мгновенно (без этой задержки).
          transition: {
            type: 'spring',
            stiffness: 320,
            damping: 24,
            delay: 0.2 + node.column * 0.09,
          },
        },
      }}
      initial="hidden"
      animate="shown"
      aria-label={
        isLocked
          ? 'Скрытое достижение'
          : isSecret
            ? 'Секретное достижение'
            : ach.title
      }
    >
      {/* Ховер-масштаб живёт на отдельном слое — иначе возврат к размеру шёл бы
          через «появляющуюся» пружину варианта (с задержкой) и тормозил. */}
      <motion.span
        className={styles.nodeIcon}
        whileHover={isLocked ? undefined : { scale: 1.12 }}
        whileTap={isLocked ? undefined : { scale: 0.95 }}
        transition={{ type: 'tween', duration: 0.1, ease: 'easeOut' }}
      >
        {isLocked ? (
          <Lock size={22} strokeWidth={1.75} />
        ) : isSecret ? (
          <span className={styles.nodeGlyph}>?</span>
        ) : hasIcon(ach.icon) ? (
          <Icon name={ach.icon} size={24} strokeWidth={1.75} />
        ) : (
          <span className={styles.nodeGlyph}>★</span>
        )}
        {isUnlocked && <span className={styles.nodeCheck}>✓</span>}
      </motion.span>
      {!isLocked && <span className={styles.nodeLabel}>{isSecret ? '???' : ach.title}</span>}
    </motion.button>
  );
}
