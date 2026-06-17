'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  projectsApi,
  ProjectBoardState,
  ProjectPlacement,
  BoardColumn,
} from '../../../lib/projects';
import { DEFAULT_COLUMNS } from '../../../lib/board';

/**
 * Колонки + позиции карточек доски ОДНОГО проекта (todo = отсутствие placement,
 * doing/custom = placement). «Выполнено» здесь НЕ хранится — это Task.completedAt
 * (см. ProjectBoardView). Оптимистичные мутации применяются синхронно.
 */
export function useProjectBoard(projectId: string | null) {
  const qc = useQueryClient();
  const key = ['project-board', projectId] as const;

  const { data } = useQuery({
    queryKey: key,
    queryFn: () => projectsApi.getBoard(projectId as string),
    enabled: !!projectId,
  });

  const columns: BoardColumn[] = data?.columns?.length ? data.columns : DEFAULT_COLUMNS;
  const doneColId = columns.find((c) => c.role === 'done')?.id ?? 'done';
  const todoColId = columns.find((c) => c.role === 'todo')?.id ?? 'todo';

  const placements = useMemo(() => {
    const m = new Map<string, ProjectPlacement>();
    for (const p of data?.placements ?? []) m.set(p.cardKey, p);
    return m;
  }, [data]);

  // ── Оптимистичные апдейты ─────────────────────────────────────
  const applyLocal = (p: ProjectPlacement) => {
    qc.setQueryData<ProjectBoardState>(key, (old) =>
      old
        ? { ...old, placements: [...old.placements.filter((x) => x.cardKey !== p.cardKey), p] }
        : old,
    );
  };
  const removeLocal = (cardKey: string) => {
    qc.setQueryData<ProjectBoardState>(key, (old) =>
      old ? { ...old, placements: old.placements.filter((x) => x.cardKey !== cardKey) } : old,
    );
  };
  const applyColumnsLocal = (cols: BoardColumn[]) => {
    qc.setQueryData<ProjectBoardState>(key, (old) => (old ? { ...old, columns: cols } : old));
  };

  const setPlacementMut = useMutation({
    mutationFn: (p: ProjectPlacement) => projectsApi.setPlacement(projectId as string, p),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
  const removePlacementMut = useMutation({
    mutationFn: (cardKey: string) => projectsApi.removePlacement(projectId as string, cardKey),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
  const setColumnsMut = useMutation({
    mutationFn: (cols: BoardColumn[]) => projectsApi.setColumns(projectId as string, cols),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const placeCard = (p: ProjectPlacement) => {
    applyLocal(p);
    setPlacementMut.mutate(p);
  };
  const removeCard = (cardKey: string) => {
    removeLocal(cardKey);
    removePlacementMut.mutate(cardKey);
  };
  const saveColumns = (cols: BoardColumn[]) => {
    applyColumnsLocal(cols);
    setColumnsMut.mutate(cols);
  };

  return { columns, doneColId, todoColId, placements, placeCard, removeCard, saveColumns };
}
