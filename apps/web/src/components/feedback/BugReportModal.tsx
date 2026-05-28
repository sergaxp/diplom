'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Paperclip, Trash2 } from 'lucide-react';
import { feedbackApi } from '../../lib/feedback';
import { storageApi, UploadedFile } from '../../lib/storage';
import { Modal, Button, IconButton, Input, Textarea } from '../ui';
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
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Сообщить о баге"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button
            type="submit"
            form="bug-report-form"
            variant="accent"
            loading={isPending}
            disabled={uploading}
          >
            Отправить
          </Button>
        </>
      }
    >
      <form id="bug-report-form" className={styles.form} onSubmit={submit}>
        <Input
          label={<>Название проблемы <span className={styles.required}>*</span></>}
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Кратко опишите проблему"
          maxLength={255}
        />

        <Textarea
          label="Описание проблемы"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Шаги для воспроизведения, ожидаемое и фактическое поведение..."
          rows={5}
        />

        <div>
          <span className={styles.label}>Скриншот / видео</span>
          <div className={styles.attachArea}>
            {files.map(f => (
              <div key={f.key} className={styles.attachItem}>
                {f.type.startsWith('image/') ? (
                  <img src={f.url} alt={f.name} className={styles.attachThumb} />
                ) : (
                  <div className={styles.attachFile}>
                    <Paperclip size={16} />
                    <span className={styles.attachName}>{f.name}</span>
                  </div>
                )}
                <IconButton
                  icon={<Trash2 size={12} />}
                  aria-label="Удалить файл"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(f)}
                  className={styles.attachRemove}
                />
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Paperclip size={16} />}
              onClick={() => fileRef.current?.click()}
              loading={uploading}
              className={styles.attachBtn}
            >
              Прикрепить файл
            </Button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,video/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}
      </form>
    </Modal>
  );
}
