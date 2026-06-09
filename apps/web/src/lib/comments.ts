import { api } from './api';

export interface CommentAuthor {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  selectedFrame: string | null;
}

export interface Comment {
  id: string;
  authorId: string;
  profileUserId: string;
  postId: string | null;
  text: string;
  createdAt: string;
  author: CommentAuthor;
}

export const commentsApi = {
  list: (username: string, postId?: string): Promise<Comment[]> =>
    api
      .get<Comment[]>('/profile/comments', {
        params: { username, ...(postId ? { postId } : {}) },
      })
      .then((r) => r.data),

  create: (data: {
    profileUsername: string;
    postId?: string;
    text: string;
  }): Promise<Comment> =>
    api.post<Comment>('/profile/comments', data).then((r) => r.data),

  remove: (id: string): Promise<void> =>
    api.delete(`/profile/comments/${id}`).then(() => undefined),
};
