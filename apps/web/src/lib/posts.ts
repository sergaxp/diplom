import { api } from './api';

export interface Post {
  id: string;
  authorId: string;
  text: string;
  imageUrl: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
}

export const postsApi = {
  list: (username: string): Promise<Post[]> =>
    api.get<Post[]>(`/profile/posts/${username}`).then((r) => r.data),

  create: (text: string, file?: File | null): Promise<Post> => {
    const fd = new FormData();
    fd.append('text', text);
    if (file) fd.append('file', file);
    // axios-интерцептор сам уберёт Content-Type для FormData
    return api.post<Post>('/profile/posts', fd).then((r) => r.data);
  },

  pin: (id: string, pinned: boolean): Promise<Post> =>
    api.patch<Post>(`/profile/posts/${id}/pin`, { pinned }).then((r) => r.data),

  remove: (id: string): Promise<void> =>
    api.delete(`/profile/posts/${id}`).then(() => undefined),
};
