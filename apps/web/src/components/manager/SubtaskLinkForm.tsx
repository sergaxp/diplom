'use client';

import { useEffect, useRef, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import type { SubtaskItem } from '../../lib/tasks';
import { parseLink } from '../../lib/linkPreview';
import styles from './SubtaskCreatePopup.module.scss';

interface Props {
  onSave: (item: SubtaskItem) => void;
  onCancel: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function SubtaskLinkForm({ onSave, onCancel }: Props) {
  const [url,   setUrl]   = useState('');
  const [title, setTitle] = useState('');
  const urlRef = useRef<HTMLInputElement>(null);
  useEffect(() => { urlRef.current?.focus(); }, []);

  const info = parseLink(url);

  const handleSubmit = () => {
    if (!info) { urlRef.current?.focus(); return; }
    onSave({
      id: uid(), kind: 'link', done: false,
      title: title.trim() || info.title || info.url,
      url: info.url, linkType: info.type, thumbnailUrl: info.thumbnailUrl,
    });
  };

  return (
    <div className={styles.overlay} onMouseDown={onCancel}>
    <div className={styles.card} onMouseDown={e => e.stopPropagation()}>
    <div className={styles.form} onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}>
      <input
        ref={urlRef}
        className={styles.titleInput}
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="Вставьте ссылку (изображение, YouTube, и т.д.)"
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } if (e.key === 'Escape') onCancel(); }}
      />
      <input
        className={styles.descInput}
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Подпись (необязательно)"
      />

      {info && (
        <div className={styles.attachGrid}>
          <div className={styles.attachItem}>
            {info.thumbnailUrl ? (
              <div className={styles.attachMedia} style={{ background: `url(${info.thumbnailUrl}) center/cover no-repeat` }}>
                {info.type === 'video' && <span className={styles.playBadge}><LucideIcons.Play size={20} strokeWidth={2}/></span>}
              </div>
            ) : (
              <div className={styles.attachFile}>
                {info.type === 'image' ? <LucideIcons.Image size={26} strokeWidth={1.5}/>
               : info.type === 'video' ? <LucideIcons.Video size={26} strokeWidth={1.5}/>
               :                          <LucideIcons.Link  size={26} strokeWidth={1.5}/>}
              </div>
            )}
            <div className={styles.attachName} title={info.url}>{info.title ?? info.url}</div>
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>Отмена</button>
        <button type="button" className={styles.submitBtn} onClick={handleSubmit} disabled={!info}>
          Добавить ссылку
        </button>
      </div>
    </div>
    </div>
    </div>
  );
}
