'use client';

import { useEffect, useState } from 'react';
import { Pencil, Trash2, X, Clock, Download, File as FileIcon } from 'lucide-react';
import type { SubtaskItem } from '../../lib/tasks';
import type { Tag } from '../../lib/tags';
import { storageApi } from '../../lib/storage';
import { Icon, hasIcon } from '../../lib/icons';
import { Modal, Button, IconButton } from '../../components/ui';
import styles from './SubtaskViewModal.module.scss';

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
    if (!lightbox) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [lightbox]);

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
    if (a.key) { try { await storageApi.remove(a.key, 'tasks'); } catch { /* ignore */ } }
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        size="md"
        hideCloseButton
        header={
          <div className={styles.headerCustom}>
            <button
              type="button"
              className={[styles.check, item.done ? styles.checkDone : ''].join(' ')}
              onClick={onToggle}
              title={item.done ? 'Снять отметку' : 'Отметить выполненным'}
              aria-pressed={item.done}
            >
              {item.done && '✓'}
            </button>

            {tag && (
              <span className={styles.titleTag} style={{ color: tag.color }} title={tag.name}>
                {hasIcon(tag.icon) ? <Icon name={tag.icon} size={16} strokeWidth={1.75} />
                       : <span className={styles.titleTagDot} style={{ background: tag.color }} />}
              </span>
            )}

            <h2 className={[styles.title, item.done ? styles.titleDone : ''].join(' ')}>{item.title}</h2>

            {item.time && (
              <span className={styles.timeChip}>
                <Clock size={12} strokeWidth={1.75} /> {item.time}
              </span>
            )}

            <IconButton
              icon={<Pencil size={16} strokeWidth={1.75} />}
              aria-label="Редактировать"
              variant="ghost"
              size="sm"
              onClick={onEdit}
            />
            {confirmDelete ? (
              <Button variant="destructive" size="sm" onClick={onDelete}>
                Удалить
              </Button>
            ) : (
              <IconButton
                icon={<Trash2 size={16} strokeWidth={1.75} />}
                aria-label="Удалить"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(true)}
              />
            )}
            <IconButton
              icon={<X size={20} />}
              aria-label="Закрыть"
              variant="ghost"
              size="sm"
              onClick={onClose}
            />
          </div>
        }
      >
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
                        {/* eslint-disable-next-line @next/next/no-img-element -- загруженное вложение, оптимизация next/image не нужна */}
                        <img src={a.url} alt={a.name} className={styles.attachMedia} />
                      </button>
                    ) : isVid ? (
                      <video src={a.url} controls className={styles.attachMedia} />
                    ) : (
                      <div className={styles.attachFile}><FileIcon size={32} strokeWidth={1.5} /></div>
                    )}
                    <div className={styles.attachInfo}>
                      <span className={styles.attachName} title={a.name}>{a.name}</span>
                      <IconButton
                        icon={<Download size={14} strokeWidth={1.75} />}
                        aria-label="Скачать"
                        variant="ghost"
                        size="sm"
                        onClick={() => download(a.url, a.name)}
                      />
                      <span className={styles.deleteWrap} data-att-confirm={i}>
                        {confirmAttIdx === i && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => removeAttachment(i)}
                          >
                            Удалить
                          </Button>
                        )}
                        <IconButton
                          icon={<X size={14} strokeWidth={2} />}
                          aria-label="Удалить вложение"
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmAttIdx(prev => prev === i ? null : i)}
                        />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Modal>

      {lightbox && (
        <div className={styles.lightbox} onMouseDown={() => setLightbox(null)} role="dialog" aria-label="Просмотр изображения">
          {/* eslint-disable-next-line @next/next/no-img-element -- полноэкранный просмотр загруженного вложения, оптимизация next/image не нужна */}
          <img src={lightbox} className={styles.lightboxImg} onMouseDown={e => e.stopPropagation()} alt="" />
          <IconButton
            icon={<X size={20} />}
            aria-label="Закрыть"
            variant="ghost"
            className={styles.lightboxClose}
            onClick={() => setLightbox(null)}
          />
        </div>
      )}
    </>
  );
}
