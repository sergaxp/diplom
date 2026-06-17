'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collabApi, type CollabEntity } from '../lib/collab';
import { getCollabSocket } from '../lib/collabSocket';
import { useAuthStore } from '../store/authStore';

interface RoomEvent {
  entityType: CollabEntity;
  entityId: string;
}

/**
 * Совместный режим для одной сущности (задачи/проекта): участники, комментарии,
 * приглашения и live-синхронизация через socket.io. Один инстанс на модалку —
 * презентационные панели только отображают возвращённые данные.
 */
export function useCollab(
  entityType: CollabEntity,
  entityId: string | null | undefined,
  enabled = true,
) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const active = enabled && !!entityId;

  const membersQuery = useQuery({
    queryKey: ['collab-members', entityType, entityId],
    queryFn: () => collabApi.members(entityType, entityId!),
    enabled: active,
  });
  const commentsQuery = useQuery({
    queryKey: ['collab-comments', entityType, entityId],
    queryFn: () => collabApi.comments(entityType, entityId!),
    enabled: active,
  });

  // Live-комната: join при монтировании, leave при размонтировании.
  useEffect(() => {
    if (!active || !entityId) return;
    const socket = getCollabSocket();
    if (!socket) return;

    const join = () => socket.emit('join', { entityType, entityId });
    join();
    socket.on('connect', join);

    const onMembers = (p: RoomEvent) => {
      if (p?.entityId !== entityId) return;
      void qc.invalidateQueries({
        queryKey: ['collab-members', entityType, entityId],
      });
      void qc.invalidateQueries({ queryKey: ['tasks'] });
    };
    const onComment = (p: RoomEvent) => {
      if (p?.entityId !== entityId) return;
      void qc.invalidateQueries({
        queryKey: ['collab-comments', entityType, entityId],
      });
    };
    const onEntity = (p: RoomEvent) => {
      if (p?.entityId !== entityId) return;
      if (entityType === 'task') {
        void qc.invalidateQueries({ queryKey: ['tasks'] });
      } else {
        void qc.invalidateQueries({ queryKey: ['project-board', entityId] });
        void qc.invalidateQueries({ queryKey: ['projects'] });
      }
    };
    socket.on('members:changed', onMembers);
    socket.on('comment:changed', onComment);
    socket.on('entity:changed', onEntity);

    return () => {
      socket.emit('leave', { entityType, entityId });
      socket.off('connect', join);
      socket.off('members:changed', onMembers);
      socket.off('comment:changed', onComment);
      socket.off('entity:changed', onEntity);
    };
  }, [active, entityType, entityId, qc]);

  const members = membersQuery.data?.members ?? [];
  const ownerId = membersQuery.data?.ownerId ?? null;
  const isOwner = !!me && !!ownerId && me.id === ownerId;
  const acceptedCount = members.filter(
    (m) => !m.isOwner && m.status === 'accepted',
  ).length;

  const invalidateMembers = () =>
    qc.invalidateQueries({
      queryKey: ['collab-members', entityType, entityId],
    });
  const invalidateComments = () =>
    qc.invalidateQueries({
      queryKey: ['collab-comments', entityType, entityId],
    });

  const invite = useMutation({
    mutationFn: (username: string) =>
      collabApi.invite(entityType, entityId!, username),
    onSuccess: () => void invalidateMembers(),
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      collabApi.removeMember(entityType, entityId!, userId),
    onSuccess: () => {
      void invalidateMembers();
      // Покинули/удалили: задачи и проекты могли стать недоступны — обновляем списки.
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
  const addComment = useMutation({
    mutationFn: (text: string) =>
      collabApi.addComment(entityType, entityId!, text),
    onSuccess: () => void invalidateComments(),
  });
  const removeComment = useMutation({
    mutationFn: (id: string) => collabApi.removeComment(id),
    onSuccess: () => void invalidateComments(),
  });

  return {
    me,
    members,
    ownerId,
    isOwner,
    acceptedCount,
    membersLoading: membersQuery.isLoading,
    comments: commentsQuery.data ?? [],
    commentsLoading: commentsQuery.isLoading,
    invite,
    removeMember,
    addComment,
    removeComment,
  };
}

export type UseCollabReturn = ReturnType<typeof useCollab>;
