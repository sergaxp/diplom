import { Dispatch, SetStateAction, useRef, useState } from 'react';
import type { Tag } from '../lib/tags';

type CreateTagFn = (name: string, color: string, icon?: string | null) => Promise<Tag>;

/** Оптимистичное создание тега из формы задачи: сразу показываем тег, синхронизируемся с сервером в фоне (с откатом при ошибке). */
export function useOptimisticTagCreate(
  userTags: Tag[],
  selectedTagId: string | null,
  setSelectedTagId: Dispatch<SetStateAction<string | null>>,
  onCreateTag?: CreateTagFn,
) {
  const [localTag, setLocalTag] = useState<Tag | null>(null);
  const pendingCreateRef = useRef<Promise<Tag> | null>(null);
  const pendingTempId    = useRef<string>('');

  const allTags = localTag && !userTags.find(t => t.id === localTag.id)
    ? [...userTags, localTag] : userTags;
  const selectedTag = selectedTagId ? allTags.find(t => t.id === selectedTagId) : undefined;

  const createTag = (data: { name: string; icon: string | null; color: string }, onCreated?: () => void) => {
    if (!onCreateTag) return;
    const nameTrimmed = data.name.trim();
    if (!nameTrimmed) return;
    if (allTags.some(t => t.name.toLowerCase() === nameTrimmed.toLowerCase())) return;

    const tempId = `__temp_${Date.now()}`;
    const tempTag: Tag = { id: tempId, name: nameTrimmed, color: data.color, icon: data.icon };
    setLocalTag(tempTag);
    setSelectedTagId(tempId);
    pendingTempId.current = tempId;
    onCreated?.();

    const promise = onCreateTag(nameTrimmed, data.color, data.icon)
      .then(realTag => {
        setLocalTag(realTag);
        setSelectedTagId(prev => prev === tempId ? realTag.id : prev);
        pendingCreateRef.current = null;
        return realTag;
      })
      .catch(() => {
        setLocalTag(null);
        setSelectedTagId(prev => prev === tempId ? null : prev);
        pendingCreateRef.current = null;
      }) as Promise<Tag>;

    pendingCreateRef.current = promise;
  };

  /** Дождаться завершения создания временного тега перед сабмитом формы. */
  const awaitPendingCreate = async () => {
    if (pendingCreateRef.current && selectedTagId?.startsWith('__temp_')) {
      try { await pendingCreateRef.current; } catch { /* proceed without tag */ }
    }
  };

  return { allTags, selectedTag, localTag, createTag, awaitPendingCreate };
}
