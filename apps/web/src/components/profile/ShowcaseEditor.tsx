'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ArrowUp, ArrowDown, X, Check, Pencil } from 'lucide-react';
import { Button, Card } from '../ui';
import {
  ShowcaseBlock,
  ShowcaseType,
  SHOWCASE_LABELS,
  showcaseApi,
  newShowcaseBlock,
} from '../../lib/showcases';
import { HEATMAP_SHOWCASE_ITEM } from '../../lib/shop';
import { profileApi } from '../../lib/profile';
import { useAuthStore } from '../../store/authStore';
import styles from './profile.module.scss';

/** Базовые витрины доступны всем; heatmap — только после покупки в магазине. */
const BASE_TYPES: ShowcaseType[] = ['stats', 'favorites', 'featuredPosts'];

export function ShowcaseEditor({
  username,
  current,
}: {
  username: string;
  current: ShowcaseBlock[];
}) {
  const { setUser } = useAuthStore();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [blocks, setBlocks] = useState<ShowcaseBlock[]>(current);

  // Инвентарь владельца — определяет, доступна ли витрина-heatmap.
  const { data: inventory = [] } = useQuery({
    queryKey: ['profileInventory', username],
    queryFn: () => showcaseApi.getInventory(username),
    enabled: open,
  });
  const ownsHeatmap = inventory.includes(HEATMAP_SHOWCASE_ITEM);

  const saveMut = useMutation({
    mutationFn: () => profileApi.update({ showcases: blocks }),
    onSuccess: (u) => {
      setUser(u);
      qc.invalidateQueries({ queryKey: ['profile', username] });
      setOpen(false);
    },
  });

  const allTypes: ShowcaseType[] = ownsHeatmap
    ? [...BASE_TYPES, 'heatmap']
    : BASE_TYPES;
  const usedTypes = new Set(blocks.map((b) => b.type));
  const available = allTypes.filter((t) => !usedTypes.has(t));

  const addBlock = (type: ShowcaseType) =>
    setBlocks((b) => [...b, newShowcaseBlock(type)]);
  const removeBlock = (id: string) =>
    setBlocks((b) => b.filter((x) => x.id !== id));
  const move = (i: number, dir: -1 | 1) =>
    setBlocks((b) => {
      const j = i + dir;
      if (j < 0 || j >= b.length) return b;
      const next = [...b];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  if (!open) {
    return (
      <Button
        variant="primary"
        size="sm"
        onClick={() => { setBlocks(current); setOpen(true); }}
        leftIcon={<Pencil size={16} strokeWidth={1.75} />}
      >
        Настроить витрины
      </Button>
    );
  }

  return (
    <Card padding="md">
      <h2 className={styles.cardTitle}>Витрины профиля</h2>

      {blocks.length === 0 ? (
        <p className={styles.mutedSmall}>Витрины не добавлены.</p>
      ) : (
        <ul className={styles.editorList}>
          {blocks.map((b, i) => (
            <li key={b.id} className={styles.editorItem}>
              <span className={styles.editorLabel}>{SHOWCASE_LABELS[b.type]}</span>
              <div className={styles.editorTools}>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Вверх">
                  <ArrowUp size={15} />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} aria-label="Вниз">
                  <ArrowDown size={15} />
                </button>
                <button type="button" onClick={() => removeBlock(b.id)} aria-label="Удалить">
                  <X size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <div className={styles.editorAdd}>
          {available.map((t) => (
            <button key={t} type="button" className={styles.editorAddBtn} onClick={() => addBlock(t)}>
              <Plus size={15} strokeWidth={2} /> {SHOWCASE_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      <div className={styles.editorActions}>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Отмена</Button>
        <Button
          variant="accent"
          size="sm"
          onClick={() => saveMut.mutate()}
          loading={saveMut.isPending}
          leftIcon={<Check size={16} strokeWidth={2} />}
        >
          Сохранить
        </Button>
      </div>
    </Card>
  );
}
