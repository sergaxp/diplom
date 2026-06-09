'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, X } from 'lucide-react';
import { AvatarFramed } from '../AvatarFramed';
import { Button, Card } from '../ui';
import { postsApi } from '../../lib/posts';
import { useAuthStore } from '../../store/authStore';
import styles from './profile.module.scss';

export function PostComposer({ username }: { username: string }) {
  const { user: me } = useAuthStore();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');

  const createMut = useMutation({
    mutationFn: () => postsApi.create(text.trim(), file),
    onSuccess: () => {
      setText('');
      clearImage();
      setError('');
      qc.invalidateQueries({ queryKey: ['posts', username] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setError(e?.response?.data?.message ?? 'Не удалось опубликовать пост'),
  });

  function pickImage(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }
  function clearImage() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!text.trim() && !file) || createMut.isPending) return;
    if (!text.trim()) { setError('Добавьте текст к посту'); return; }
    createMut.mutate();
  };

  if (!me) return null;

  return (
    <Card padding="md">
      <form className={styles.composer} onSubmit={submit}>
        <div className={styles.composerTop}>
          <AvatarFramed
            avatarUrl={me.avatarUrl}
            displayName={me.displayName}
            username={me.username}
            frameId={me.selectedFrame}
            size={40}
          />
          <textarea
            className={styles.composerInput}
            value={text}
            maxLength={2000}
            rows={2}
            placeholder="Поделитесь чем-нибудь…"
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        {preview && (
          <div className={styles.composerPreview}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="превью" className={styles.composerPreviewImg} />
            <button type="button" className={styles.composerPreviewRemove} onClick={clearImage} aria-label="Убрать изображение">
              <X size={16} />
            </button>
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.composerActions}>
          <button
            type="button"
            className={styles.composerImgBtn}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus size={18} strokeWidth={1.75} />
            <span>Картинка</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif"
            className={styles.fileInput}
            onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ''; }}
          />
          <Button
            type="submit"
            variant="accent"
            size="sm"
            loading={createMut.isPending}
            disabled={!text.trim() && !file}
          >
            Опубликовать
          </Button>
        </div>
      </form>
    </Card>
  );
}
