'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Task, TaskRepeat, TaskType, TaskPriority, RepeatConfig, SubtaskSection, SubtaskItem, toDateStr } from '../../lib/tasks';
import { DatePickerPopup, getDateButtonLabel } from './DatePickerPopup';
import { RepeatConfigModal } from './RepeatConfigModal';
import { TimePickerField } from './TimePickerField';
import { TagManager } from './TagManager';
import { SubtaskCreatePopup } from './SubtaskCreatePopup';
import { SubtaskLinkForm } from './SubtaskLinkForm';
import { SubtaskViewModal } from './SubtaskViewModal';
import { MediaViewModal } from './MediaViewModal';
import { storageApi } from '../../lib/storage';
import type { Tag } from '../../lib/tags';
import { useDayWeather, weatherCodeToInfo } from '../../lib/weather';
import { useAuthStore } from '../../store/authStore';
import { Modal, Button, IconButton } from '../../components/ui';
import { X } from 'lucide-react';
import styles from './TaskFormModal.module.scss';

type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number }>;
const Icons = LucideIcons as unknown as Record<string, LucideIcon>;

const uid = () => Math.random().toString(36).slice(2, 10);

const MONTHS_GEN = [
  'января','февраля','марта','апреля','мая','июня',
  'июля','августа','сентября','октября','ноября','декабря',
];

// ── Draft ──────────────────────────────────────────────────────
const DRAFT_TTL = 10 * 60 * 1000;

interface Draft {
  title: string; description: string; time: string; endTime: string;
  repeat: TaskRepeat; hasEnd: boolean; repeatUntil: string;
  type: TaskType; priority: TaskPriority; tagId: string | null; multiDay: boolean; endDate: string;
  sections: SubtaskSection[];
  savedAt: number;
}

function draftKey(dateStr: string) { return `wt_draft_${dateStr}`; }

function loadDraft(dateStr: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(dateStr));
    if (!raw) return null;
    const d: Draft = JSON.parse(raw);
    if (Date.now() - d.savedAt > DRAFT_TTL) { localStorage.removeItem(draftKey(dateStr)); return null; }
    return d;
  } catch { return null; }
}

function saveDraft(dateStr: string, d: Draft) {
  localStorage.setItem(draftKey(dateStr), JSON.stringify(d));
}

function clearDraft(dateStr: string) {
  localStorage.removeItem(draftKey(dateStr));
}

const REPEAT_LABELS: Record<TaskRepeat, string> = {
  none: 'Без повтора', daily: 'Каждый день', weekdays: 'Будни (Пн-Пт)',
  weekly: 'Каждую неделю', monthly: 'Каждый месяц', yearly: 'Каждый год',
  custom: 'Настраиваемый',
};

const TYPE_LABELS: Record<TaskType, string> = {
  normal: 'Обычная', mandatory: 'Дедлайн', event: 'Эвент',
};

const DEFAULT_TAG_COLOR = '#4F46E5';

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  none:   'Без приоритета',
  low:    'Средне важно',
  medium: 'Важно',
  high:   'Очень важно',
};

const PRIORITY_COLORS: Record<TaskPriority, string | undefined> = {
  none: undefined, low: '#eab308', medium: '#3b82f6', high: '#ef4444',
};

const TYPE_COLORS: Record<string, string | undefined> = {
  normal: undefined, mandatory: '#ef4444', event: '#8b5cf6',
};

// ── WeatherWidget ─────────────────────────────────────────────
function WeatherWidget({ date }: { date: string }) {
  const user = useAuthStore(s => s.user);
  const location = { lat: user?.locationLat, lon: user?.locationLon, name: user?.location };
  const { data: weather, isLoading, isError } = useDayWeather(date, location);

  const today      = new Date(); today.setHours(0, 0, 0, 0);
  const targetDate = new Date(date + 'T00:00:00');
  const daysDiff   = Math.round((targetDate.getTime() - today.getTime()) / 86_400_000);

  const dateLabel = (() => {
    if (daysDiff === 0) return 'Сегодня';
    if (daysDiff === 1) return 'Завтра';
    if (daysDiff === -1) return 'Вчера';
    const d = new Date(date + 'T00:00:00');
    return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
  })();

  if (daysDiff > 16) {
    return (
      <div className={styles.weatherCard}>
        <div className={styles.weatherHeader}>
          {(() => { const C = Icons['Cloud']; return C ? <C size={18} strokeWidth={1.5} /> : '☁'; })()}
          <span className={styles.weatherTitle}>{dateLabel}</span>
        </div>
        <p className={styles.weatherNote}>Прогноз доступен только на 16 дней вперёд</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.weatherCard}>
        <div className={styles.weatherHeader}>
          {(() => { const C = Icons['Cloud']; return C ? <C size={18} strokeWidth={1.5} /> : '☁'; })()}
          <span className={styles.weatherTitle}>{dateLabel}</span>
        </div>
        <p className={styles.weatherNote}>Загрузка прогноза...</p>
      </div>
    );
  }

  if (isError || !weather) {
    return (
      <div className={styles.weatherCard}>
        <div className={styles.weatherHeader}>
          {(() => { const C = Icons['Cloud']; return C ? <C size={18} strokeWidth={1.5} /> : '☁'; })()}
          <span className={styles.weatherTitle}>{dateLabel}</span>
        </div>
        <p className={styles.weatherNote}>Не удалось загрузить прогноз</p>
      </div>
    );
  }

  const { label, icon } = weatherCodeToInfo(weather.weatherCode);
  const WeatherIcon = Icons[icon] ?? Icons['Cloud'];
  const WindIcon    = Icons['Wind'];
  const DropIcon    = Icons['Droplets'];
  const ThermoIcon  = Icons['Thermometer'];
  const SunIcon     = Icons['Sun'];
  const RainIcon    = Icons['CloudRain'];

  return (
    <div className={styles.weatherCard}>
      <div className={styles.weatherHeader}>
        <WeatherIcon size={20} strokeWidth={1.5} />
        <span className={styles.weatherTitle}>{dateLabel}</span>
        <span className={styles.weatherCondition}>{label}</span>
      </div>

      <div className={styles.weatherTemps}>
        <span className={styles.weatherTempMax}>{weather.tempMax > 0 ? '+' : ''}{weather.tempMax}°</span>
        <span className={styles.weatherTempMin}>{weather.tempMin > 0 ? '+' : ''}{weather.tempMin}°</span>
      </div>

      <div className={styles.weatherRows}>
        {ThermoIcon && (
          <div className={styles.weatherRow}>
            <ThermoIcon size={12} strokeWidth={1.75} />
            <span>Ощущается</span>
            <span className={styles.weatherRowVal}>
              {weather.feelsLikeMax > 0 ? '+' : ''}{weather.feelsLikeMax}°
            </span>
          </div>
        )}
        {RainIcon && (
          <div className={styles.weatherRow}>
            <RainIcon size={12} strokeWidth={1.75} />
            <span>Осадки</span>
            <span className={styles.weatherRowVal}>
              {weather.precipProbMax}% · {weather.precipSum} мм
            </span>
          </div>
        )}
        {WindIcon && (
          <div className={styles.weatherRow}>
            <WindIcon size={12} strokeWidth={1.75} />
            <span>Ветер</span>
            <span className={styles.weatherRowVal}>{weather.windSpeedMax} км/ч</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SubtaskSectionComp ────────────────────────────────────────
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

const ATTACH_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/ogg,application/zip,application/x-7z-compressed,application/x-rar-compressed,application/pdf';

type FormState = null | 'subtask-new' | 'subtask-edit' | 'link';

function SubtaskSectionComp({ section, collapsed, canDelete, userTags, parentDate, onToggleCollapse, onChange, onDelete }: SectionProps) {
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
                          <LucideIcons.Clock size={10} strokeWidth={2}/> {item.time}
                        </span>
                      )}
                      {tag && (() => {
                        const TagIc = tag.icon ? (LucideIcons as unknown as Record<string, LucideIcon>)[tag.icon] : null;
                        return (
                          <span className={styles.cardBadge} style={{ borderColor: tag.color, color: tag.color }}>
                            {TagIc ? <TagIc size={10} strokeWidth={2}/>
                                   : <span className={styles.tagBadgeDot} style={{ background: tag.color }}/>}
                            {tag.name}
                          </span>
                        );
                      })()}
                      {item.attachments && item.attachments.length > 0 && (
                        <span className={styles.cardBadge}>
                          <LucideIcons.Paperclip size={10} strokeWidth={2}/> {item.attachments.length}
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
                              <LucideIcons.Play size={28} strokeWidth={2}/>
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
                          <LucideIcons.FileText size={22} strokeWidth={1.5}/>
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
                                  <LucideIcons.Play size={32} strokeWidth={2}/>
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
                          <LucideIcons.Link size={22} strokeWidth={1.5}/>
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
                <LucideIcons.Plus size={14} strokeWidth={2}/> Подзадача
              </button>
              <button type="button" className={styles.addActionBtn} onClick={() => attachRef.current?.click()}>
                <LucideIcons.Paperclip size={13} strokeWidth={2}/> Вложение
              </button>
              <button type="button" className={styles.addActionBtn} onClick={() => setFormState('link')}>
                <LucideIcons.Link size={13} strokeWidth={2}/> Ссылка
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

// ── Main modal ────────────────────────────────────────────────
interface Props {
  task?: Task;
  date: Date;
  isAdmin: boolean;
  userTags: Tag[];
  onSave: (data: Omit<Task, 'id' | 'status'>) => void;
  onClose: () => void;
  onDelete?: () => void;
  onCreateTag?: (name: string, color: string, icon?: string | null) => Promise<Tag>;
  /** When set (edit mode), section changes (add/delete subtask, add attachment, etc.)
   *  immediately persist to the server, independent of the form's Save button. */
  onSectionsLiveUpdate?: (sections: SubtaskSection[]) => void;
}

export function TaskFormModal({ task, date, isAdmin, userTags, onSave, onClose, onDelete, onCreateTag, onSectionsLiveUpdate }: Props) {
  const isEdit      = !!task;
  const initialDate = useMemo(() => toDateStr(date), [date]);
  const draft       = useMemo(() => (!isEdit ? loadDraft(initialDate) : null), [isEdit, initialDate]);

  const makeDefaultSections = (): SubtaskSection[] => [{ id: uid(), title: 'Основное', items: [] }];

  const [title,         setTitle]         = useState(task?.title       ?? draft?.title       ?? '');
  const [description,   setDescription]   = useState(task?.description ?? draft?.description ?? '');
  const [formDate,      setFormDate]      = useState(task?.date        ?? initialDate);
  const [time,          setTime]          = useState(task?.time        ?? draft?.time        ?? '');
  const [endTime,       setEndTime]       = useState(task?.endTime     ?? draft?.endTime     ?? '');
  const [multiDay,      setMultiDay]      = useState(task?.type !== 'mandatory' && !!(task?.endDate ?? draft?.multiDay));
  const [endDate,       setEndDate]       = useState(task?.endDate     ?? draft?.endDate     ?? '');
  const [repeat,        setRepeat]        = useState<TaskRepeat>(task?.repeat ?? draft?.repeat ?? 'none');
  const [hasEnd,        setHasEnd]        = useState(task ? !!task.repeatUntil : (draft?.hasEnd ?? false));
  const [repeatUntil,   setRepeatUntil]   = useState(task?.repeatUntil ?? draft?.repeatUntil ?? '');
  const [type,          setType]          = useState<TaskType>(task?.type ?? draft?.type ?? 'normal');
  const [priority,      setPriority]      = useState<TaskPriority>(task?.priority ?? draft?.priority ?? 'none');
  const [repeatConfig,    setRepeatConfig]    = useState<RepeatConfig | null>(task?.repeatConfig ?? null);
  const [selectedTagId,   setSelectedTagId]   = useState<string | null>(task?.tags?.[0]?.id ?? draft?.tagId ?? null);
  const [datePickerOpen,  setDatePickerOpen]  = useState(false);
  const [repeatConfigOpen, setRepeatConfigOpen] = useState(false);
  const [tagDropOpen,      setTagDropOpen]      = useState(false);
  const [tagDropPos,       setTagDropPos]       = useState<{top:number;left:number}|null>(null);
  const [creatingTag,      setCreatingTag]      = useState(false);
  const [localTag,         setLocalTag]         = useState<Tag|null>(null);
  const [priorityDropOpen, setPriorityDropOpen] = useState(false);
  const [priorityDropPos,  setPriorityDropPos]  = useState<{top:number;left:number}|null>(null);
  const [typeDropOpen,     setTypeDropOpen]     = useState(false);
  const [typeDropPos,      setTypeDropPos]      = useState<{top:number;left:number}|null>(null);
  const dateBtnRef      = useRef<HTMLButtonElement>(null);
  const tagBtnRef       = useRef<HTMLButtonElement>(null);
  const tagDropRef      = useRef<HTMLDivElement>(null);
  const priorityBtnRef  = useRef<HTMLButtonElement>(null);
  const priorityDropRef = useRef<HTMLDivElement>(null);
  const typeBtnRef      = useRef<HTMLButtonElement>(null);
  const typeDropRef     = useRef<HTMLDivElement>(null);
  const pendingCreateRef = useRef<Promise<Tag> | null>(null);
  const pendingTempId    = useRef<string>('');
  const [sections,      setSections]      = useState<SubtaskSection[]>(() => {
    if (task?.subtasks && task.subtasks.length > 0) return task.subtasks;
    if (draft?.sections && draft.sections.length > 0) return draft.sections;
    return makeDefaultSections();
  });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  // Sync sections when items are deleted externally (e.g., from another device)
  const prevTaskSubtasksRef = useRef<SubtaskSection[] | undefined>(task?.subtasks);
  useEffect(() => {
    if (!isEdit || !task?.subtasks) return;
    const prev = prevTaskSubtasksRef.current ?? [];
    prevTaskSubtasksRef.current = task.subtasks;
    const prevIds = new Set(prev.flatMap(s => s.items.map(i => i.id)));
    const newIds  = new Set(task.subtasks.flatMap(s => s.items.map(i => i.id)));
    if ([...prevIds].some(id => !newIds.has(id))) {
      setSections(task.subtasks);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.subtasks]);

  const cap = (v: string) => v ? v.charAt(0).toUpperCase() + v.slice(1) : v;

  const clearForm = () => {
    setTitle(''); setDescription(''); setTime(''); setEndTime('');
    setPriority('none'); setRepeat('none'); setHasEnd(false); setRepeatUntil('');
    setRepeatConfig(null); setSelectedTagId(null);
    setFormDate(initialDate);
    setMultiDay(false);
    setEndDate('');
    setSections(makeDefaultSections());
    clearDraft(initialDate);
  };

  useEffect(() => {
    if (isEdit || !title.trim()) return;
    saveDraft(initialDate, {
      title, description, time, endTime, multiDay, endDate,
      repeat, hasEnd, repeatUntil, type, priority, tagId: selectedTagId,
      sections, savedAt: Date.now(),
    });
  }, [title, description, time, endTime, multiDay, endDate, repeat, hasEnd, repeatUntil, type, priority, selectedTagId, sections, isEdit, initialDate]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const allTags = localTag && !userTags.find(t => t.id === localTag.id)
    ? [...userTags, localTag] : userTags;
  const selectedTag = selectedTagId ? allTags.find(t => t.id === selectedTagId) : undefined;
  const TagIcon     = selectedTag?.icon ? Icons[selectedTag.icon] : null;

  const toggleTag = (id: string) => setSelectedTagId(prev => prev === id ? null : id);

  const clampDrop = (r: DOMRect, dropW = 220, dropH = 240): { top: number; left: number } => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(r.left, vw - dropW - 8);
    const top  = r.bottom + 4 + dropH > vh ? r.top - dropH - 4 : r.bottom + 4;
    return { top, left: Math.max(8, left) };
  };

  const openTagDrop = () => {
    if (tagDropOpen) { setTagDropOpen(false); return; }
    if (tagBtnRef.current) {
      setTagDropPos(clampDrop(tagBtnRef.current.getBoundingClientRect()));
    }
    setTagDropOpen(true);
    setCreatingTag(false);
  };

  // Optimistic tag creation: shows tag immediately, syncs with server in background
  const handleCreateNewTag = (data: { name: string; icon: string | null; color: string }) => {
    if (!onCreateTag) return;
    const nameTrimmed = data.name.trim();
    if (!nameTrimmed) return;
    if (allTags.some(t => t.name.toLowerCase() === nameTrimmed.toLowerCase())) return;

    const tempId = `__temp_${Date.now()}`;
    const tempTag: Tag = { id: tempId, name: nameTrimmed, color: data.color, icon: data.icon };
    setLocalTag(tempTag);
    setSelectedTagId(tempId);
    pendingTempId.current = tempId;
    setCreatingTag(false);
    setTagDropOpen(false);

    const promise = onCreateTag(nameTrimmed, data.color, data.icon)
      .then(realTag => {
        setLocalTag(realTag);
        setSelectedTagId(prev => prev === tempId ? realTag.id : prev);
        pendingCreateRef.current = null;
        return realTag;
      })
      .catch(() => {
        setLocalTag(null);
        setSelectedTagId(prev => prev === tempId ? null : prev);
        pendingCreateRef.current = null;
      }) as Promise<Tag>;

    pendingCreateRef.current = promise;
  };

  useEffect(() => {
    if (!tagDropOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!tagBtnRef.current?.contains(t) && !tagDropRef.current?.contains(t)) {
        setTagDropOpen(false); setCreatingTag(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [tagDropOpen]);

  const openDrop = (
    btnRef: React.RefObject<HTMLButtonElement | null>,
    setOpen: (v: boolean) => void,
    setPos: (p: {top:number;left:number}) => void,
    isOpen: boolean,
    dropW = 180,
    dropH = 160,
  ) => {
    if (isOpen) { setOpen(false); return; }
    if (btnRef.current) {
      setPos(clampDrop(btnRef.current.getBoundingClientRect(), dropW, dropH));
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!priorityDropOpen) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!priorityBtnRef.current?.contains(t) && !priorityDropRef.current?.contains(t))
        setPriorityDropOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [priorityDropOpen]);

  useEffect(() => {
    if (!typeDropOpen) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!typeBtnRef.current?.contains(t) && !typeDropRef.current?.contains(t))
        setTypeDropOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [typeDropOpen]);

  const liveUpdate = (next: SubtaskSection[]) => {
    if (isEdit && onSectionsLiveUpdate) onSectionsLiveUpdate(next);
  };

  const updateSection = (idx: number, s: SubtaskSection) =>
    setSections(prev => {
      const next = prev.map((sec, i) => i === idx ? s : sec);
      liveUpdate(next);
      return next;
    });

  const deleteSection = (idx: number) =>
    setSections(prev => {
      const next = prev.filter((_, i) => i !== idx);
      liveUpdate(next);
      return next;
    });

  const addSection = () =>
    setSections(prev => {
      const next = [...prev, { id: uid(), title: 'Новый раздел', items: [] }];
      liveUpdate(next);
      return next;
    });

  const toggleCollapse = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const availableTypes: TaskType[] = isAdmin
    ? ['normal', 'mandatory', 'event']
    : ['normal', 'mandatory'];

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    // If a temp tag is selected and still pending, wait for the real ID
    if (pendingCreateRef.current && selectedTagId?.startsWith('__temp_')) {
      try { await pendingCreateRef.current; } catch { /* proceed without tag */ }
    }
    if (!isEdit) clearDraft(initialDate);

    const resolvedEndDate = multiDay && endDate && endDate > formDate ? endDate : undefined;

    onSave({
      title:       trimmed,
      description: description.trim() || undefined,
      date:        formDate,
      endDate:     resolvedEndDate,
      time:        time || undefined,
      endTime:     (time && endTime && endTime > time) ? endTime : undefined,
      repeat,
      repeatUntil: (repeat !== 'none' && hasEnd && repeatUntil) ? repeatUntil : undefined,
      type,
      priority,
      repeatConfig: repeatConfig ?? undefined,
      icon:        selectedTag?.icon ?? null,
      tags:        selectedTag ? [selectedTag] : [],
      subtasks:    sections,
    });
    onClose();
  };

  return (
    <>
    <Modal
      open
      onClose={onClose}
      size="xl"
      noPadding
      hideCloseButton
      ariaLabel={isEdit ? 'Редактирование задачи' : 'Новая задача'}
      className={styles.taskModalChrome}
    >
        {/* Mobile-only: weather at the very top */}
        <div className={styles.weatherTopMobile}>
          <WeatherWidget date={isEdit ? toDateStr(date) : formDate} />
        </div>

        {/* ── Top: иконка + название + описание + мета-поля + теги ── */}
        <div className={styles.top}>
          <div className={styles.titleRow}>
            {TagIcon && (
              <span className={styles.taskIconPreview} style={{ color: selectedTag?.color }}>
                <TagIcon size={20} strokeWidth={1.75} />
              </span>
            )}
            <input
              ref={titleRef}
              className={styles.titleInput}
              value={title}
              onChange={e => setTitle(cap(e.target.value))}
              placeholder="Название задачи"
            />
            <IconButton
              icon={<X size={20} />}
              aria-label="Закрыть"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className={styles.closeBtn}
            />
          </div>

          {/* Описание – под названием */}
          <textarea
            className={styles.descInput}
            value={description}
            onChange={e => setDescription(cap(e.target.value))}
            placeholder="Описание задачи"
            rows={2}
          />

          {/* Мета-поля: дата, время, приоритет – под описанием */}
          <div className={styles.metaRow}>

            {/* Дата – кнопка с попапом */}
            <div className={styles.datePickerWrap}>
              <div className={styles.field}>
                <button
                  ref={dateBtnRef}
                  type="button"
                  className={`${styles.dateBtn} ${datePickerOpen ? styles.dateBtnOpen : ''}`}
                  onClick={() => setDatePickerOpen(v => !v)}
                >
                  {getDateButtonLabel(formDate)}
                  {multiDay && endDate && (
                    <span className={styles.dateBtnEnd}>
                      {' '}– {new Date(endDate + 'T00:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  {repeat !== 'none' && <span className={styles.dateBtnRepeat}>↻</span>}
                </button>
              </div>
              {datePickerOpen && (
                <DatePickerPopup
                  triggerRef={dateBtnRef}
                  date={formDate}
                  endDate={endDate}
                  multiDay={multiDay}
                  repeat={repeat}
                  repeatUntil={repeatUntil}
                  hasRepeatUntil={hasEnd}
                  repeatConfig={repeatConfig}
                  taskType={type}
                  onChangeDate={setFormDate}
                  onChangeEndDate={setEndDate}
                  onChangeMultiDay={setMultiDay}
                  onChangeRepeat={setRepeat}
                  onChangeRepeatUntil={setRepeatUntil}
                  onChangeHasRepeatUntil={setHasEnd}
                  onChangeRepeatConfig={setRepeatConfig}
                  onOpenRepeatConfig={() => setRepeatConfigOpen(true)}
                  onClose={repeatConfigOpen ? () => {} : () => setDatePickerOpen(false)}
                />
              )}
            </div>

            {/* Время */}
            <TimePickerField
              value={time}
              endValue={endTime}
              taskDate={formDate}
              onChange={setTime}
              onChangeEnd={setEndTime}
            />

            {/* Приоритет */}
            <button
              ref={priorityBtnRef}
              type="button"
              className={[styles.metaBtn, priority !== 'none' ? styles.metaBtnColored : ''].join(' ')}
              style={PRIORITY_COLORS[priority] ? { color: PRIORITY_COLORS[priority], borderColor: PRIORITY_COLORS[priority] + '55' } : {}}
              onClick={() => openDrop(priorityBtnRef, setPriorityDropOpen, setPriorityDropPos, priorityDropOpen)}
            >
              {PRIORITY_COLORS[priority] && <span className={styles.metaBtnDot} style={{ background: PRIORITY_COLORS[priority] }} />}
              {PRIORITY_LABELS[priority]}
            </button>

            {/* Тег – кнопка с дропдауном */}
            <button
              ref={tagBtnRef}
              type="button"
              className={[styles.tagBtn, selectedTag ? styles.tagBtnActive : ''].join(' ')}
              style={selectedTag ? { borderColor: selectedTag.color, color: selectedTag.color } : {}}
              onClick={openTagDrop}
            >
              {selectedTag ? (
                <>
                  <span className={styles.tagBtnDot} style={{ background: selectedTag.color }} />
                  {selectedTag.name}
                </>
              ) : '# Тег'}
            </button>

            {/* Тип задачи */}
            <button
              ref={typeBtnRef}
              type="button"
              className={[styles.metaBtn, type !== 'normal' ? styles.metaBtnColored : ''].join(' ')}
              style={TYPE_COLORS[type] ? { color: TYPE_COLORS[type], borderColor: TYPE_COLORS[type] + '55' } : {}}
              onClick={() => openDrop(typeBtnRef, setTypeDropOpen, setTypeDropPos, typeDropOpen)}
            >
              {TYPE_COLORS[type] && <span className={styles.metaBtnDot} style={{ background: TYPE_COLORS[type] }} />}
              {TYPE_LABELS[type]}
            </button>

          </div>
        </div>

        <form onSubmit={handleSubmit} className={styles.formWrap}>
          <div className={styles.body}>

            {/* LEFT – подзадачи */}
            <div className={styles.left}>
              {sections.map((sec, idx) => (
                <SubtaskSectionComp
                  key={sec.id}
                  section={sec}
                  collapsed={collapsed.has(sec.id)}
                  canDelete={sections.length > 1}
                  userTags={allTags}
                  parentDate={formDate}
                  onToggleCollapse={() => toggleCollapse(sec.id)}
                  onChange={s => updateSection(idx, s)}
                  onDelete={() => deleteSection(idx)}
                />
              ))}
              <button type="button" className={styles.addSectionBtn} onClick={addSection}>
                + Добавить раздел
              </button>
            </div>

            {/* RIGHT – погода */}
            <div className={styles.right}>
              <WeatherWidget date={isEdit ? toDateStr(date) : formDate} />
            </div>
          </div>

          {/* Footer */}
          <div className={styles.footer}>
            <div className={styles.footerLeft}>
              {isEdit && onDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => { onDelete(); onClose(); }}
                >
                  Удалить
                </Button>
              )}
              {!isEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearForm}
                >
                  Очистить
                </Button>
              )}
            </div>
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={onClose}>Отмена</Button>
              <Button variant="accent" type="submit" disabled={!title.trim()}>
                {isEdit ? 'Сохранить' : 'Создать'}
              </Button>
            </div>
          </div>
        </form>
    </Modal>

    {priorityDropOpen && priorityDropPos && (
      <div
        ref={priorityDropRef}
        className={styles.metaDropdown}
        style={{ top: priorityDropPos.top, left: priorityDropPos.left }}
        onMouseDown={e => e.stopPropagation()}
      >
        {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map(p => (
          <button
            key={p}
            type="button"
            className={[styles.metaDropItem, priority === p ? styles.metaDropItemActive : ''].join(' ')}
            onClick={() => { setPriority(p); setPriorityDropOpen(false); }}
          >
            {PRIORITY_COLORS[p]
              ? <span className={styles.metaDropDot} style={{ background: PRIORITY_COLORS[p] }} />
              : <span className={styles.metaDropDotNone} />}
            {PRIORITY_LABELS[p]}
            {priority === p && <span className={styles.metaDropCheck}>✓</span>}
          </button>
        ))}
      </div>
    )}

    {typeDropOpen && typeDropPos && (
      <div
        ref={typeDropRef}
        className={styles.metaDropdown}
        style={{ top: typeDropPos.top, left: typeDropPos.left }}
        onMouseDown={e => e.stopPropagation()}
      >
        {availableTypes.map(t => (
          <button
            key={t}
            type="button"
            className={[styles.metaDropItem, type === t ? styles.metaDropItemActive : ''].join(' ')}
            onClick={() => {
              setType(t);
              if (t === 'mandatory' && multiDay) { setMultiDay(false); setEndDate(''); }
              setTypeDropOpen(false);
            }}
          >
            {TYPE_COLORS[t]
              ? <span className={styles.metaDropDot} style={{ background: TYPE_COLORS[t] }} />
              : <span className={styles.metaDropDotNone} />}
            {TYPE_LABELS[t]}
            {type === t && <span className={styles.metaDropCheck}>✓</span>}
          </button>
        ))}
      </div>
    )}

    {tagDropOpen && tagDropPos && (
      <div
        ref={tagDropRef}
        className={styles.tagDropdown}
        style={{ top: tagDropPos.top, left: tagDropPos.left }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Без тега */}
        <button
          type="button"
          className={[styles.tagDropItem, !selectedTagId ? styles.tagDropItemActive : ''].join(' ')}
          onClick={() => { setSelectedTagId(null); setTagDropOpen(false); }}
        >
          <span className={styles.tagDropDotNone} />
          <span className={styles.tagDropName}>Без тега</span>
          {!selectedTagId && <span className={styles.tagDropCheck}>✓</span>}
        </button>

        {allTags.map(tag => {
          const Ic     = tag.icon ? Icons[tag.icon] : null;
          const active = selectedTagId === tag.id;
          return (
            <button
              key={tag.id}
              type="button"
              className={[styles.tagDropItem, active ? styles.tagDropItemActive : ''].join(' ')}
              onClick={() => { toggleTag(tag.id); setTagDropOpen(false); }}
            >
              <span className={styles.tagDropDot} style={{ background: tag.color }} />
              {Ic && <Ic size={11} strokeWidth={2} />}
              <span className={styles.tagDropName}>{tag.name}</span>
              {active && <span className={styles.tagDropCheck}>✓</span>}
            </button>
          );
        })}

        <div className={styles.tagDropDivider} />

        {!creatingTag ? (
          <button
            type="button"
            className={styles.tagDropCreate}
            onClick={() => setCreatingTag(true)}
          >
            + Создать тег
          </button>
        ) : (
          <div className={styles.tagCreateWrap}>
            <TagManager
              alwaysOpen
              tags={[]}
              onCreate={handleCreateNewTag}
              onDelete={() => {}}
              onUpdate={() => {}}
            />
          </div>
        )}
      </div>
    )}

    {repeatConfigOpen && (
      <RepeatConfigModal
        initial={repeatConfig}
        selectedDate={formDate}
        taskEndDate={multiDay ? endDate : undefined}
        multiDay={multiDay}
        onSave={(cfg, until) => {
          setRepeat('custom');
          setRepeatConfig(cfg);
          if (until !== undefined) {
            setHasEnd(!!until);
            if (until) setRepeatUntil(until);
          }
          setRepeatConfigOpen(false);
        }}
        onClose={() => setRepeatConfigOpen(false)}
      />
    )}
  </>
  );
}
