'use client';

import {
  Download, Trash2, File as FileIcon, Play, Video, Image as ImageIcon, Link as LinkIcon, ExternalLink, X,
} from 'lucide-react';
import type { SubtaskItem } from '../../lib/tasks';
import { Modal, Button, IconButton } from '../../components/ui';
import styles from './MediaViewModal.module.scss';

interface Props {
  item: SubtaskItem; // expects kind === 'attachment' or 'link'
  onClose: () => void;
  onDelete: () => void;
}

export function MediaViewModal({ item, onClose, onDelete }: Props) {
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
        // eslint-disable-next-line @next/next/no-img-element -- загруженное вложение, оптимизация next/image не нужна
        return <img src={a.url} alt={a.name} className={styles.fullMedia} />;
      }
      if (a.type.startsWith('video/')) {
        return <video src={a.url} controls autoPlay className={styles.fullMedia} />;
      }
      return (
        <div className={styles.fileBox}>
          <FileIcon size={64} strokeWidth={1.25} />
          <div className={styles.fileName}>{a.name}</div>
          {a.size != null && <div className={styles.fileSize}>{(a.size / 1024).toFixed(1)} КБ</div>}
        </div>
      );
    }
    if (isLink && item.url) {
      if (item.linkType === 'image' && item.thumbnailUrl) {
        // eslint-disable-next-line @next/next/no-img-element -- превью внешней ссылки, оптимизация next/image не нужна
        return <img src={item.thumbnailUrl} alt={item.title || item.url} className={styles.fullMedia} />;
      }
      return (
        <div className={styles.linkPreview}>
          {item.thumbnailUrl ? (
            <div className={styles.linkThumb} style={{ backgroundImage: `url(${item.thumbnailUrl})` }}>
              {item.linkType === 'video' && (
                <span className={styles.linkPlay}><Play size={48} strokeWidth={1.75} /></span>
              )}
            </div>
          ) : (
            <div className={styles.fileBox}>
              {item.linkType === 'video' ? <Video size={64} strokeWidth={1.25} />
             : item.linkType === 'image' ? <ImageIcon size={64} strokeWidth={1.25} />
             :                              <LinkIcon  size={64} strokeWidth={1.25} />}
            </div>
          )}
          <Button
            href={item.url}
            target="_blank"
            rel="noreferrer"
            variant="primary"
            leftIcon={<ExternalLink size={16} strokeWidth={2} />}
          >
            Открыть ссылку
          </Button>
        </div>
      );
    }
    return null;
  };

  const title = isAttachment ? item.attachment!.name : (item.title || item.url || '');

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      hideCloseButton
      header={
        <div className={styles.headerCustom}>
          <h2 className={styles.title} title={title}>{title}</h2>
          {isAttachment && (
            <IconButton
              icon={<Download size={16} strokeWidth={1.75} />}
              aria-label="Скачать"
              variant="ghost"
              size="sm"
              onClick={downloadFile}
            />
          )}
          <IconButton
            icon={<Trash2 size={16} strokeWidth={1.75} />}
            aria-label="Удалить"
            variant="ghost"
            size="sm"
            onClick={onDelete}
          />
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
      <div className={styles.mediaBody}>
        {renderMedia()}
      </div>
    </Modal>
  );
}
