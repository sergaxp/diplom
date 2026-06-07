'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, Paperclip, Play, FileText, Link as LinkIcon, Plus } from 'lucide-react';
import { SubtaskSection, SubtaskItem } from '../../../lib/tasks';
import { storageApi } from '../../../lib/storage';
import type { Tag } from '../../../lib/tags';
import { Icon, hasIcon } from '../../../lib/icons';
import { SubtaskCreatePopup } from '../SubtaskCreatePopup';
import { SubtaskLinkForm } from '../SubtaskLinkForm';
import { SubtaskViewModal } from '../SubtaskViewModal';
import { MediaViewModal } from '../MediaViewModal';
import { ATTACH_ACCEPT } from './constants';
import styles from './TaskFormModal.module.scss';

const uid = () => Math.random().toString(36).slice(2, 10);

interface SectionProps {
  section: SubtaskSection;
  collapsed: boolean;
  canDelete: boolean;
  userTags: Tag[];
  parentDate: string;
  onToggleCollapse: () => void;
  onChange: (s: SubtaskSection) => void;
  onDelete: () => void;
}

type FormState = null | 'subtask-new' | 'subtask-edit' | 'link';

export function SubtaskSectionComp({ section, collapsed, canDelete, userTags, parentDate, onToggleCollapse, onChange, onDelete }: SectionProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal,     setTitleVal]     = useState(section.title);
  const [formState,    setFormState]    = useState<FormState>(null);
  const [editingItem,  setEditingItem]  = useState<SubtaskItem | null>(null);
  const [viewItem,     setViewItem]     = useState<SubtaskItem | null>(null);
  const [mediaItem,    setMediaItem]    = useState<SubtaskItem | null>(null);
  const [confirmId,    setConfirmId]    = useState<string | null>(null);
  const [uploading,    setUploading]    = useState(0);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const attachRef     = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.select();
  }, [editingTitle]);

  // Close inline confirm-delete on outside click
  useEffect(() => {
    if (!confirmId) return;
    const h = (e: MouseEvent) => {
      const tgt = e.target as Element;
      if (!tgt.closest(`[data-confirm-id="${confirmId}"]`)) setConfirmId(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [confirmId]);

  const commitTitle = () => {
    setEditingTitle(false);
    const t = titleVal.trim() || section.title;
    setTitleVal(t);
    onChange({ ...section, title: t });
  };

  const replaceItems = (mut: (items: SubtaskItem[]) => SubtaskItem[]) =>
    onChange({ ...section, items: mut(section.items) });

  const toggleItem = (itemId: string) =>
    replaceItems(items => items.map(it => it.id === itemId ? { ...it, done: !it.done } : it));

  // Delete a section item – also removes its files from MinIO
  const deleteItem = async (item: SubtaskItem) => {
    replaceItems(items => items.filter(it => it.id !== item.id));
    setConfirmId(null);

    const keys: string[] = [];
    if (item.attachment?.key) keys.push(item.attachment.key);
    if (item.attachments) for (const a of item.attachments) if (a.key) keys.push(a.key);
    for (const k of keys) { try { await storageApi.remove(k, 'tasks'); } catch { /* ignore */ } }
  };

  const upsertItem = (item: SubtaskItem) => {
    // For edits: detect attachments that were removed and delete them from MinIO too
    const prev = section.items.find(it => it.id === item.id);
    if (prev?.attachments) {
      const newKeys = new Set((item.attachments ?? []).map(a => a.key).filter(Boolean) as string[]);
      for (const a of prev.attachments) {
        if (a.key && !newKeys.has(a.key)) { try { storageApi.remove(a.key, 'tasks'); } catch { /* ignore */ } }
      }
    }
    replaceItems(items => {
      const existing = items.findIndex(it => it.id === item.id);
      if (existing >= 0) { const copy = [...items]; copy[existing] = item; return copy; }
      return [...items, item];
    });
    setFormState(null);
    setEditingItem(null);
    // If we were editing an item that's currently shown in view modal, keep it open with new data
    if (viewItem && viewItem.id === item.id) setViewItem(item);
  };

  const handleAttachFiles = async (files: FileList | null) => {
    if (!files) return;
    setUploading(c => c + files.length);
    const created: SubtaskItem[] = [];
    for (const f of Array.from(files)) {
      try {
        const up = await storageApi.upload(f, 'tasks');
        created.push({
          id: uid(), kind: 'attachment', title: up.name, done: false,
          attachment: { name: up.name, url: up.url, type: up.type, size: up.size, key: up.key },
        });
      } catch (e) {
        console.error('upload failed', e);
      } finally {
        setUploading(c => c - 1);
      }
    }
    if (created.length) replaceItems(items => [...items, ...created]);
  };

  // Inline delete button row with confirm
  const renderDelete = (it: SubtaskItem) => (
    <span className={styles.deleteWrap} data-confirm-id={it.id}>
      {confirmId === it.id && (
        <button
          type="button"
          className={styles.confirmDeleteBtn}
          onClick={(e) => { e.stopPropagation(); deleteItem(it); }}
        >Удалить</button>
      )}
      <button
        type="button"
        className={styles.subtaskDeleteBtn}
        onClick={(e) => { e.stopPropagation(); setConfirmId(prev => prev === it.id ? null : it.id); }}
      >×</button>
    </span>
  );

  return (
    <div className={styles.section}>
      <div className={styles.sectionHead}>
        <button type="button" className={styles.collapseBtn} onClick={onToggleCollapse}>
          {collapsed ? '▶' : '▼'}
        </button>
        {editingTitle ? (
          <input
            ref={titleInputRef}
            className={styles.sectionTitleInput}
            value={titleVal}
            onChange={e => setTitleVal(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitTitle(); }
              if (e.key === 'Escape') { setTitleVal(section.title); setEditingTitle(false); }
            }}
          />
        ) : (
          <span className={styles.sectionTitle} onClick={() => setEditingTitle(true)} title="Нажмите для переименования">
            {section.title}
          </span>
        )}
        {canDelete && (
          <button type="button" className={styles.sectionDeleteBtn} onClick={onDelete} title="Удалить раздел">×</button>
        )}
      </div>

      {!collapsed && (() => {
        // Split items: subtasks (rendered as rows above), media (telegram-style grid below)
        const subtasks = section.items.filter(it => (it.kind ?? 'subtask') === 'subtask');
        const media    = section.items.filter(it => it.kind === 'attachment' || it.kind === 'link');

        return (
        <>
          <ul className={styles.subtaskList}>
            {subtasks.map(item => {
              const tag = item.tagId ? userTags.find(t => t.id === item.tagId) : undefined;
              return (
                <li
                  key={item.id}
                  className={[styles.cardSubtask, item.done ? styles.cardSubtaskDone : ''].join(' ')}
                >
                  <button
                    type="button"
                    className={[styles.cardCheck, item.done ? styles.cardCheckDone : ''].join(' ')}
                    onClick={(e) => { e.stopPropagation(); toggleItem(item.id); }}
                  >
                    {item.done && '✓'}
                  </button>
                  <div className={styles.cardMain} onClick={() => setViewItem(item)} role="button" tabIndex={0}>
                    <div className={styles.cardTitle}>{item.title}</div>
                    {item.description && (
                      <div className={styles.cardDesc}>{item.description}</div>
                    )}
                    <div className={styles.cardBadges}>
                      {item.time && (
                        <span className={styles.cardBadge}>
                          <Clock size={10} strokeWidth={2}/> {item.time}
                        </span>
                      )}
                      {tag && (
                        <span className={styles.cardBadge} style={{ borderColor: tag.color, color: tag.color }}>
                          {hasIcon(tag.icon) ? <Icon name={tag.icon} size={10} strokeWidth={2}/>
                                 : <span className={styles.tagBadgeDot} style={{ background: tag.color }}/>}
                          {tag.name}
                        </span>
                      )}
                      {item.attachments && item.attachments.length > 0 && (
                        <span className={styles.cardBadge}>
                          <Paperclip size={10} strokeWidth={2}/> {item.attachments.length}
                        </span>
                      )}
                    </div>
                  </div>
                  {renderDelete(item)}
                </li>
              );
            })}

            {uploading > 0 && (
              <li className={styles.uploadingRow}>Загрузка {uploading} файл(ов)…</li>
            )}
          </ul>

          {media.length > 0 && (
            <div className={styles.mediaList}>
              {media.map(item => {
                const isConfirming = confirmId === item.id;
                const cornerDelete = (
                  <div
                    className={styles.tileDelete}
                    data-confirm-id={item.id}
                  >
                    {isConfirming && (
                      <button
                        type="button"
                        className={styles.tileConfirmBtn}
                        onClick={(e) => { e.stopPropagation(); deleteItem(item); }}
                      >Удалить</button>
                    )}
                    <button
                      type="button"
                      className={styles.tileX}
                      onClick={(e) => { e.stopPropagation(); setConfirmId(prev => prev === item.id ? null : item.id); }}
                      title="Удалить"
                    >×</button>
                  </div>
                );

                // ─── Attachment ───────────────────────────────────
                if (item.kind === 'attachment' && item.attachment) {
                  const a = item.attachment;
                  const isImg = a.type.startsWith('image/');
                  const isVid = a.type.startsWith('video/');

                  // Image / video – media block
                  if (isImg || isVid) {
                    return (
                      <div key={item.id} className={styles.tgMedia}>
                        <button
                          type="button"
                          className={styles.tgMediaBtn}
                          onClick={() => setMediaItem(item)}
                          title={a.name}
                        >
                          {isImg
                            ? <img src={a.url} alt={a.name} className={styles.tgMediaImg}/>
                            : <video src={a.url} muted className={styles.tgMediaImg}/>}
                          {isVid && (
                            <span className={styles.tgMediaPlay}>
                              <Play size={28} strokeWidth={2}/>
                            </span>
                          )}
                        </button>
                        {cornerDelete}
                      </div>
                    );
                  }

                  // Generic file – horizontal card (PDF/zip/etc.)
                  const sizeKb = a.size != null ? (a.size / 1024).toFixed(1) + ' КБ' : '';
                  return (
                    <div key={item.id} className={styles.tgFile}>
                      <button
                        type="button"
                        className={styles.tgFileBody}
                        onClick={() => setMediaItem(item)}
                        title={a.name}
                      >
                        <span className={styles.tgFileIcon}>
                          <FileText size={22} strokeWidth={1.5}/>
                        </span>
                        <span className={styles.tgFileText}>
                          <span className={styles.tgFileName}>{a.name}</span>
                          {sizeKb && <span className={styles.tgFileMeta}>{sizeKb}</span>}
                        </span>
                      </button>
                      {cornerDelete}
                    </div>
                  );
                }

                // ─── Link ─────────────────────────────────────────
                if (item.kind === 'link' && item.url) {
                  const isVid = item.linkType === 'video';
                  const host  = (() => { try { return new URL(item.url).hostname.replace(/^www\./, ''); } catch { return ''; } })();

                  // Link with rich preview (YouTube etc.)
                  if (item.thumbnailUrl) {
                    return (
                      <div key={item.id} className={styles.tgLink}>
                        <a
                          className={styles.tgLinkBody}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={item.url}
                        >
                          <span className={styles.tgLinkUrl}>{item.url}</span>
                          <span className={styles.tgLinkCard}>
                            {host && <span className={styles.tgLinkSource}>{host}</span>}
                            {item.title && item.title !== item.url && (
                              <span className={styles.tgLinkTitle}>{item.title}</span>
                            )}
                            <span
                              className={styles.tgLinkThumb}
                              style={{ backgroundImage: `url(${item.thumbnailUrl})` }}
                            >
                              {isVid && (
                                <span className={styles.tgMediaPlay}>
                                  <Play size={32} strokeWidth={2}/>
                                </span>
                              )}
                            </span>
                          </span>
                        </a>
                        {cornerDelete}
                      </div>
                    );
                  }

                  // Plain link – compact card with icon
                  return (
                    <div key={item.id} className={styles.tgFile}>
                      <a
                        className={styles.tgFileBody}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={item.url}
                      >
                        <span className={styles.tgFileIcon}>
                          <LinkIcon size={22} strokeWidth={1.5}/>
                        </span>
                        <span className={styles.tgFileText}>
                          <span className={styles.tgFileName}>{item.title || item.url}</span>
                          {host && <span className={styles.tgFileMeta}>{host}</span>}
                        </span>
                      </a>
                      {cornerDelete}
                    </div>
                  );
                }

                return null;
              })}
            </div>
          )}

          {/* 3 action buttons (hidden while a form is open) */}
          {formState === null && (
            <div className={styles.addActions}>
              <button type="button" className={styles.addActionBtn} onClick={() => setFormState('subtask-new')}>
                <Plus size={14} strokeWidth={2}/> Подзадача
              </button>
              <button type="button" className={styles.addActionBtn} onClick={() => attachRef.current?.click()}>
                <Paperclip size={13} strokeWidth={2}/> Вложение
              </button>
              <button type="button" className={styles.addActionBtn} onClick={() => setFormState('link')}>
                <LinkIcon size={13} strokeWidth={2}/> Ссылка
              </button>
              <input
                ref={attachRef}
                type="file"
                multiple
                accept={ATTACH_ACCEPT}
                style={{ display: 'none' }}
                onChange={e => { handleAttachFiles(e.target.files); e.target.value = ''; }}
              />
            </div>
          )}

          {(formState === 'subtask-new' || formState === 'subtask-edit') && (
            <SubtaskCreatePopup
              initial={formState === 'subtask-edit' ? (editingItem ?? undefined) : undefined}
              userTags={userTags}
              parentDate={parentDate}
              onSave={upsertItem}
              onCancel={() => { setFormState(null); setEditingItem(null); }}
            />
          )}

          {formState === 'link' && (
            <SubtaskLinkForm
              onSave={upsertItem}
              onCancel={() => setFormState(null)}
            />
          )}
        </>
        );
      })()}

      {viewItem && (
        <SubtaskViewModal
          item={viewItem}
          userTags={userTags}
          onClose={() => setViewItem(null)}
          onToggle={() => {
            const next = { ...viewItem, done: !viewItem.done };
            replaceItems(items => items.map(it => it.id === viewItem.id ? next : it));
            setViewItem(next);
          }}
          onEdit={() => { setEditingItem(viewItem); setFormState('subtask-edit'); setViewItem(null); }}
          onDelete={() => { deleteItem(viewItem); setViewItem(null); }}
          onUpdate={(next) => {
            replaceItems(items => items.map(it => it.id === next.id ? next : it));
            setViewItem(next);
          }}
        />
      )}

      {mediaItem && (
        <MediaViewModal
          item={mediaItem}
          onClose={() => setMediaItem(null)}
          onDelete={() => { deleteItem(mediaItem); setMediaItem(null); }}
        />
      )}
    </div>
  );
}
