'use client';

import { useEffect, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import type { SubtaskItem } from '../../lib/tasks';
import type { Tag } from '../../lib/tags';
import { storageApi } from '../../lib/storage';
import styles from './SubtaskViewModal.module.scss';

type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number }>;
const Icons = LucideIcons as unknown as Record<string, LucideIcon>;

interface Props {
  item: SubtaskItem;
  userTags: Tag[];
  onClose: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  /** Persist updated item back to parent (also called when an attachment is removed). */
  onUpdate: (item: SubtaskItem) => void;
}

export function SubtaskViewModal({ item, userTags, onClose, onEdit, onToggle, onDelete, onUpdate }: Props) {
  const [lightbox,      setLightbox]      = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmAttIdx, setConfirmAttIdx] = useState<number | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (lightbox) setLightbox(null); else onClose(); } };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose, lightbox]);

  // Close attachment confirm on outside click
  useEffect(() => {
    if (confirmAttIdx === null) return;
    const h = (e: MouseEvent) => {
      const tgt = e.target as Element;
      if (!tgt.closest(`[data-att-confirm="${confirmAttIdx}"]`)) setConfirmAttIdx(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [confirmAttIdx]);

  const tag = item.tagId ? userTags.find(t => t.id === item.tagId) : undefined;
  const TagIc = tag?.icon ? Icons[tag.icon] : null;

  const download = (url: string, name: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const removeAttachment = async (idx: number) => {
    const a = item.attachments?.[idx];
    if (!a) return;
    const next: SubtaskItem = {
      ...item,
      attachments: item.attachments?.filter((_, i) => i !== idx),
    };
    if (next.attachments && next.attachments.length === 0) delete next.attachments;
    onUpdate(next);
    setConfirmAttIdx(null);
    if (a.key) { try { await storageApi.remove(a.key); } catch { /* ignore */ } }
  };

  return (
    <>
      <div className={styles.overlay} onMouseDown={onClose}>
        <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>
          <div className={styles.head}>
            <button
              type="button"
              className={[styles.check, item.done ? styles.checkDone : ''].join(' ')}
              onClick={onToggle}
              title={item.done ? 'Снять отметку' : 'Отметить выполненным'}
            >
              {item.done && '✓'}
            </button>

            {/* Tag icon before title */}
            {tag && (
              <span className={styles.titleTag} style={{ color: tag.color }} title={tag.name}>
                {TagIc ? <TagIc size={16} strokeWidth={1.75}/>
                       : <span className={styles.titleTagDot} style={{ background: tag.color }}/>}
              </span>
            )}

            <h2 className={[styles.title, item.done ? styles.titleDone : ''].join(' ')}>{item.title}</h2>

            {/* Time – top-right corner */}
            {item.time && (
              <span className={styles.timeChip}>
                <Icons.Clock size={12} strokeWidth={1.75}/> {item.time}
              </span>
            )}

            <button type="button" className={styles.editBtn} onClick={onEdit} title="Редактировать">
              <Icons.Pencil size={14} strokeWidth={1.75}/>
            </button>
            {confirmDelete ? (
              <button type="button" className={styles.confirmBtn} onClick={onDelete}>
                Удалить
              </button>
            ) : (
              <button type="button" className={styles.delBtn} onClick={() => setConfirmDelete(true)} title="Удалить">
                <Icons.Trash2 size={14} strokeWidth={1.75}/>
              </button>
            )}
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">✕</button>
          </div>

          <div className={styles.body}>
            {item.description && (
              <div className={styles.descBlock}>{item.description}</div>
            )}

            {item.attachments && item.attachments.length > 0 && (
              <>
                <h3 className={styles.sectionLabel}>Вложения</h3>
                <div className={styles.attachGrid}>
                  {item.attachments.map((a, i) => {
                    const isImg = a.type.startsWith('image/');
                    const isVid = a.type.startsWith('video/');
                    return (
                      <div key={i} className={styles.attachItem}>
                        {isImg ? (
                          <button
                            type="button"
                            className={styles.attachMediaBtn}
                            onClick={() => setLightbox(a.url)}
                            title="Открыть"
                          >
                            <img src={a.url} alt={a.name} className={styles.attachMedia}/>
                          </button>
                        ) : isVid ? (
                          <video src={a.url} controls className={styles.attachMedia}/>
                        ) : (
                          <div className={styles.attachFile}><Icons.File size={32} strokeWidth={1.5}/></div>
                        )}
                        <div className={styles.attachInfo}>
                          <span className={styles.attachName} title={a.name}>{a.name}</span>
                          <button
                            type="button"
                            className={styles.attachAction}
                            onClick={() => download(a.url, a.name)}
                            title="Скачать"
                          >
                            <Icons.Download size={13} strokeWidth={1.75}/>
                          </button>
                          <span className={styles.deleteWrap} data-att-confirm={i}>
                            {confirmAttIdx === i && (
                              <button
                                type="button"
                                className={styles.confirmAttBtn}
                                onClick={() => removeAttachment(i)}
                              >Удалить</button>
                            )}
                            <button
                              type="button"
                              className={styles.attachAction}
                              onClick={() => setConfirmAttIdx(prev => prev === i ? null : i)}
                              title="Удалить вложение"
                            >
                              <Icons.X size={13} strokeWidth={2}/>
                            </button>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {lightbox && (
        <div className={styles.lightbox} onMouseDown={() => setLightbox(null)}>
          <img src={lightbox} className={styles.lightboxImg} onMouseDown={e => e.stopPropagation()}/>
          <button type="button" className={styles.lightboxClose} onClick={() => setLightbox(null)}>✕</button>
        </div>
      )}
    </>
  );
}
