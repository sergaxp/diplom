import { api } from './api';

export interface UploadedFile {
  url: string;
  key: string;        // server-side key, needed for deletion
  name: string;
  type: string;
  size: number;
}

export const storageApi = {
  /** Uploads a file to MinIO via backend. Returns the public URL and storage key. */
  async upload(file: File): Promise<UploadedFile> {
    const form = new FormData();
    form.append('file', file);
    const r = await api.post<UploadedFile>('/storage/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return r.data;
  },

  /** Deletes a file by its storage key. */
  async remove(key: string): Promise<void> {
    await api.delete('/storage/object', { data: { key } });
  },
};
