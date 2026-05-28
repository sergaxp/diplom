'use client';

import { useEffect, useRef, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import type { SubtaskItem } from '../../lib/tasks';
import { parseLink } from '../../lib/linkPreview';
import { storageApi } from '../../lib/storage';
import { Modal, Button, Input } from '../../components/ui';
import styles from './SubtaskCreatePopup.module.scss';

interface Props {
  onSave: (item: SubtaskItem) => void;
  onCancel: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function SubtaskLinkForm({ onSave, onCancel }: Props) {
  const [url,          setUrl]          = useState('');
  const [title,        setTitle]        = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [fetching,     setFetching]     = useState(false);
  const [fetchedThumb, setFetchedThumb] = useState<string | null>(null);

  const urlRef   = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { urlRef.current?.focus(); }, []);

  const info = parseLink(url);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    setFetchedThumb(null);

    if (!info) return;

    debounce.current = setTimeout(async () => {
      setFetching(true);
      try {
        const preview = await storageApi.linkPreview(info.url);
        if (preview.title && !titleTouched) {
          setTitle(preview.title);
        }
        if (preview.thumbnailUrl) {
          setFetchedThumb(preview.thumbnailUrl);
        }
      } catch {
        // не критично
      } finally {
        setFetching(false);
      }
    }, 700);

    return () => { if (debounce.current) clearTimeout(debounce.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const effectiveThumb = fetchedThumb ?? info?.thumbnailUrl ?? null;

  const handleSubmit = () => {
    if (!info) { urlRef.current?.focus(); return; }
    onSave({
      id: uid(), kind: 'link', done: false,
      title: title.trim() || info.title || info.url,
      url: info.url,
      linkType: info.type,
      thumbnailUrl: effectiveThumb ?? undefined,
    });
  };

  return (
    <Modal
      open
      onClose={onCancel}
      size="sm"
      title="Добавить ссылку"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Отмена</Button>
          <Button variant="accent" onClick={handleSubmit} disabled={!info || fetching}>
            Добавить ссылку
          </Button>
        </>
      }
    >
      <div className={styles.form} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }}>
        <Input
          ref={urlRef}
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="Вставьте ссылку (изображение, YouTube, и т.д.)"
        />

        <Input
          value={title}
          onChange={e => { setTitle(e.target.value); setTitleTouched(true); }}
          placeholder={fetching ? 'Загружаем подпись...' : 'Подпись (необязательно)'}
          suffix={fetching ? <LucideIcons.Loader2 size={14} className={styles.titleLoader} /> : undefined}
        />

        {info && (
          <div className={styles.attachGrid}>
            <div className={styles.attachItem}>
              {effectiveThumb ? (
                <div className={styles.attachMedia} style={{ background: `url(${effectiveThumb}) center/cover no-repeat` }}>
                  {info.type === 'video' && <span className={styles.playBadge}><LucideIcons.Play size={20} strokeWidth={2} /></span>}
                </div>
              ) : (
                <div className={styles.attachFile}>
                  {info.type === 'image' ? <LucideIcons.Image size={24} strokeWidth={1.5} />
                 : info.type === 'video' ? <LucideIcons.Video size={24} strokeWidth={1.5} />
                 :                          <LucideIcons.Link  size={24} strokeWidth={1.5} />}
                </div>
              )}
              <div className={styles.attachName} title={info.url}>
                {title || info.title || info.url}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
