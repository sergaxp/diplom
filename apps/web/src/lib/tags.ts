import { api } from './api';

export interface Tag {
  id: string;
  name: string;
  icon: string | null;
  color: string;
}

export const tagsApi = {
  getAll: (): Promise<Tag[]> =>
    api.get<Tag[]>('/tags').then(r => r.data),

  create: (data: { name: string; icon?: string | null; color?: string }): Promise<Tag> =>
    api.post<Tag>('/tags', data).then(r => r.data),

  update: (id: string, data: { name?: string; icon?: string | null; color?: string }): Promise<Tag> =>
    api.patch<Tag>(`/tags/${id}`, data).then(r => r.data),

  remove: (id: string): Promise<void> =>
    api.delete(`/tags/${id}`).then(() => undefined),
};
