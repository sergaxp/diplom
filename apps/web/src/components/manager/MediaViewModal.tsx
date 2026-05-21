'use client';

import { useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import type { SubtaskItem } from '../../lib/tasks';
import styles from './SubtaskViewModal.module.scss';

type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number }>;
const Icons = LucideIcons as unknown as Record<string, LucideIcon>;

interface Props {
  item: SubtaskItem; // expects kind === 'attachment' or 'link'
  onClose: () => void;
  onDelete: () => void;
}

export function MediaViewModal({ item, onClose, onDelete }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const isAttachment = item.kind === 'attachment' && item.attachment;
  const isLink       = item.kind === 'link' && item.url;

  const downloadFile = () => {
    if (!isAttachment || !item.attachment) return;
    const a = document.createElement('a');
    a.href = item.attachment.url;
    a.download = item.attachment.name;
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const renderMedia = () => {
    if (isAttachment && item.attachment) {
      const a = item.attachment;
      if (a.type.startsWith('image/')) {
        return <img src={a.url} alt={a.name} className={styles.fullMedia}/>;
      }
      if (a.type.startsWith('video/')) {
        return <video src={a.url} controls autoPlay className={styles.fullMedia}/>;
      }
      return (
        <div className={styles.fileBox}>
          <Icons.File size={64} strokeWidth={1.25}/>
          <div className={styles.fileName}>{a.name}</div>
          {a.size != null && <div className={styles.fileSize}>{(a.size / 1024).toFixed(1)} КБ</div>}
        </div>
      );
    }
    if (isLink && item.url) {
      if (item.linkType === 'image' && item.thumbnailUrl) {
        return <img src={item.thumbnailUrl} alt={item.title || item.url} className={styles.fullMedia}/>;
      }
      // For video / page links — show preview and open-in-new-tab button
      return (
        <div className={styles.linkPreview}>
          {item.thumbnailUrl ? (
            <div className={styles.linkThumb} style={{ backgroundImage: `url(${item.thumbnailUrl})` }}>
              {item.linkType === 'video' && (
                <span className={styles.linkPlay}><Icons.Play size={48} strokeWidth={1.75}/></span>
              )}
            </div>
          ) : (
            <div className={styles.fileBox}>
              {item.linkType === 'video' ? <Icons.Video size={64} strokeWidth={1.25}/>
             : item.linkType === 'image' ? <Icons.Image size={64} strokeWidth={1.25}/>
             :                              <Icons.Link  size={64} strokeWidth={1.25}/>}
            </div>
          )}
          <a href={item.url} target="_blank" rel="noreferrer" className={styles.openLinkBtn}>
            <Icons.ExternalLink size={14} strokeWidth={2}/> Открыть ссылку
          </a>
        </div>
      );
    }
    return null;
  };

  const title = isAttachment ? item.attachment!.name : (item.title || item.url || '');

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>
        <div className={styles.head}>
          <h2 className={styles.title} title={title}>{title}</h2>
          {isAttachment && (
            <button type="button" className={styles.editBtn} onClick={downloadFile} title="Скачать">
              <Icons.Download size={14} strokeWidth={1.75}/>
            </button>
          )}
          <button type="button" className={styles.delBtn} onClick={onDelete} title="Удалить">
            <Icons.Trash2 size={14} strokeWidth={1.75}/>
          </button>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        <div className={styles.mediaBody}>
          {renderMedia()}
        </div>
      </div>
    </div>
  );
}
