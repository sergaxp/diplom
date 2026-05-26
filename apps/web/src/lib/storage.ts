import { api } from './api';

export type StorageBucket = 'tasks' | 'feedback';

export interface UploadedFile {
  url: string;
  key: string;
  name: string;
  type: string;
  size: number;
}

export interface LinkPreview {
  title: string | null;
  thumbnailUrl: string | null;
}

export const storageApi = {
  async upload(file: File, bucket: StorageBucket): Promise<UploadedFile> {
    const form = new FormData();
    form.append('file', file);
    const r = await api.post<UploadedFile>(`/storage/upload?bucket=${bucket}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return r.data;
  },

  async remove(key: string, bucket: StorageBucket): Promise<void> {
    await api.delete('/storage/object', { data: { key, bucket } });
  },

  async linkPreview(url: string): Promise<LinkPreview> {
    const r = await api.get<LinkPreview>(`/storage/link-preview?url=${encodeURIComponent(url)}`);
    return r.data;
  },
};
