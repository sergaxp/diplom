import { api } from './api';

export type CollabEntity = 'task' | 'project';
export type CollabStatus = 'pending' | 'accepted' | 'declined';

export interface MiniProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  selectedFrame: string | null;
}

export interface CollabMember extends MiniProfile {
  status: CollabStatus;
  isOwner: boolean;
}

export interface MembersResult {
  ownerId: string;
  members: CollabMember[];
}

export interface CollabComment {
  id: string;
  text: string;
  createdAt: string;
  author: MiniProfile;
}

export interface UserSearchResult extends MiniProfile {
  /** Состояние относительно сущности: уже участник / приглашён / можно пригласить. */
  state: 'none' | 'pending' | 'member';
}

export const collabApi = {
  search: (
    q: string,
    entityType?: CollabEntity,
    entityId?: string,
  ): Promise<UserSearchResult[]> =>
    api
      .get<UserSearchResult[]>('/collab/search', {
        params: { q, entityType, entityId },
      })
      .then((r) => r.data),

  members: (entityType: CollabEntity, id: string): Promise<MembersResult> =>
    api
      .get<MembersResult>(`/collab/${entityType}/${id}/members`)
      .then((r) => r.data),

  invite: (
    entityType: CollabEntity,
    id: string,
    username: string,
  ): Promise<CollabMember> =>
    api
      .post<CollabMember>(`/collab/${entityType}/${id}/invite`, { username })
      .then((r) => r.data),

  respond: (
    entityType: CollabEntity,
    id: string,
    accept: boolean,
  ): Promise<{ status: CollabStatus }> =>
    api
      .post<{ status: CollabStatus }>(`/collab/${entityType}/${id}/respond`, {
        accept,
      })
      .then((r) => r.data),

  removeMember: (
    entityType: CollabEntity,
    id: string,
    userId: string,
  ): Promise<void> =>
    api
      .delete(`/collab/${entityType}/${id}/members/${userId}`)
      .then(() => undefined),

  comments: (entityType: CollabEntity, id: string): Promise<CollabComment[]> =>
    api
      .get<CollabComment[]>(`/collab/${entityType}/${id}/comments`)
      .then((r) => r.data),

  addComment: (
    entityType: CollabEntity,
    id: string,
    text: string,
  ): Promise<CollabComment> =>
    api
      .post<CollabComment>(`/collab/${entityType}/${id}/comments`, { text })
      .then((r) => r.data),

  removeComment: (commentId: string): Promise<void> =>
    api.delete(`/collab/comments/${commentId}`).then(() => undefined),
};
