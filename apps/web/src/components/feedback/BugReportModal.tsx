'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Paperclip, Trash2 } from 'lucide-react';
import { feedbackApi } from '../../lib/feedback';
import { storageApi, UploadedFile } from '../../lib/storage';
import styles from './FeedbackModal.module.scss';

interface Props {
  onClose: () => void;
}

export function BugReportModal({ onClose }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle]       = useState('');
  const [desc, setDesc]         = useState('');
  const [files, setFiles]       = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError]       = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () => feedbackApi.createBugReport({
      title: title.trim(),
      description: desc.trim() || undefined,
      attachmentUrls: files.map(f => f.url),
      attachmentKeys: files.map(f => f.key),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-bug-reports'] });
      onClose();
    },
    onError: () => setError('Не удалось отправить. Попробуйте снова.'),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;
    setUploading(true);
    setError('');
    try {
      const uploaded = await Promise.all(picked.map(f => storageApi.upload(f, 'feedback')));
      setFiles(prev => [...prev, ...uploaded]);
    } catch {
      setError('Ошибка загрузки файла. Макс. размер — 50 МБ.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeFile = async (file: UploadedFile) => {
    setFiles(prev => prev.filter(f => f.key !== file.key));
    try { await storageApi.remove(file.key, 'feedback'); } catch { /* ignore */ }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Введите название проблемы'); return; }
    setError('');
    mutate();
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>Сообщить о баге</span>
          <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>

        <form className={styles.form} onSubmit={submit}>
          <label className={styles.label}>
            Название проблемы <span className={styles.required}>*</span>
          </label>
          <input
            className={styles.input}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Кратко опишите проблему"
            maxLength={255}
          />

          <label className={styles.label}>Описание проблемы</label>
          <textarea
            className={styles.textarea}
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Шаги для воспроизведения, ожидаемое и фактическое поведение..."
            rows={5}
          />

          <label className={styles.label}>Скриншот / видео</label>
          <div className={styles.attachArea}>
            {files.map(f => (
              <div key={f.key} className={styles.attachItem}>
                {f.type.startsWith('image/') ? (
                  <img src={f.url} alt={f.name} className={styles.attachThumb} />
                ) : (
                  <div className={styles.attachFile}>
                    <Paperclip size={14} />
                    <span className={styles.attachName}>{f.name}</span>
                  </div>
                )}
                <button
                  type="button"
                  className={styles.attachRemove}
                  onClick={() => removeFile(f)}
                  title="Удалить"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className={styles.attachBtn}
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <Paperclip size={14} />
              {uploading ? 'Загрузка...' : 'Прикрепить файл'}
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,video/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Отмена</button>
            <button type="submit" className={styles.submitBtn} disabled={isPending || uploading}>
              {isPending ? 'Отправка...' : 'Отправить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
