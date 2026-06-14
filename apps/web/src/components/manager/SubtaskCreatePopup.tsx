'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Paperclip, File as FileIcon } from 'lucide-react';
import { popLayer } from '../../lib/motion';
import { clampDrop } from './task-form/anchor';
import type { SubtaskItem, SubtaskAttachment } from '../../lib/tasks';
import type { Tag } from '../../lib/tags';
import { storageApi } from '../../lib/storage';
import { Icon, hasIcon } from '../../lib/icons';
import { TimePickerField } from './TimePickerField';
import { Modal, Button, Textarea } from '../../components/ui';
import styles from './SubtaskCreatePopup.module.scss';

const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/ogg,application/zip,application/x-7z-compressed,application/x-rar-compressed,application/pdf';

const cap = (v: string) => v ? v.charAt(0).toUpperCase() + v.slice(1) : v;
const uid = () => Math.random().toString(36).slice(2, 10);

type DayScope = 'this' | 'all' | 'select';

interface Props {
  initial?: Partial<SubtaskItem>;
  userTags: Tag[];
  parentDate: string;
  /** Дни серии (YYYY-MM-DD). Если больше одного — показываем выбор области по дням. */
  seriesDays?: string[];
  /** День, для которого открыт редактор («только этот день»). */
  currentDay?: string;
  onSave: (item: SubtaskItem) => void;
  onCancel: () => void;
}

const fmtDay = (ds: string): string =>
  new Date(ds + 'T00:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'short' });

export function SubtaskCreatePopup({ initial, userTags, parentDate, seriesDays, currentDay, onSave, onCancel }: Props) {
  const [title,        setTitle]        = useState(initial?.title       ?? '');
  const [description,  setDescription]  = useState(initial?.description ?? '');
  const [time,         setTime]         = useState(initial?.time        ?? '');
  const [tagId,        setTagId]        = useState<string | null>(initial?.tagId ?? null);
  const [attachments,  setAttachments]  = useState<SubtaskAttachment[]>(initial?.attachments ?? []);
  const [tagDropOpen,  setTagDropOpen]  = useState(false);
  const [tagDropPos,   setTagDropPos]   = useState<{top:number;left:number}|null>(null);
  const [uploading,    setUploading]    = useState(0);

  // ── Область «дни» (только для серий) ─────────────────────────────
  const isSeries = !!seriesDays && seriesDays.length > 1;
  const today    = currentDay ?? parentDate;
  const [dayScope,     setDayScope]     = useState<DayScope>(() => {
    const d = initial?.days;
    if (!d || d.length === 0) return 'all';
    if (d.length === 1 && d[0] === today) return 'this';
    return 'select';
  });
  const [selectedDays, setSelectedDays] = useState<string[]>(() => {
    const d = initial?.days;
    return d && d.length ? d : (today ? [today] : []);
  });

  const toggleDay = (ds: string) =>
    setSelectedDays(prev => prev.includes(ds) ? prev.filter(x => x !== ds) : [...prev, ds]);

  // Итоговое значение `days` для сохранения (undefined ⇒ все дни).
  const resolveDays = (): string[] | undefined => {
    if (!isSeries) return undefined;
    if (dayScope === 'all')  return undefined;
    if (dayScope === 'this') return today ? [today] : undefined;
    return selectedDays.length ? [...selectedDays] : (today ? [today] : undefined);
  };

  const addedKeysRef   = useRef<string[]>([]);
  const removedKeysRef = useRef<string[]>([]);

  const titleRef = useRef<HTMLTextAreaElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);
  const tagBtnRef  = useRef<HTMLButtonElement>(null);
  const tagDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  useEffect(() => {
    if (!tagDropOpen) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!tagBtnRef.current?.contains(t) && !tagDropRef.current?.contains(t)) setTagDropOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [tagDropOpen]);

  const selectedTag = tagId ? userTags.find(t => t.id === tagId) : undefined;

  const openTagDrop = () => {
    if (tagDropOpen) { setTagDropOpen(false); return; }
    if (tagBtnRef.current) {
      const r = tagBtnRef.current.getBoundingClientRect();
      setTagDropPos(clampDrop(r, 180, 200, window.innerWidth, window.innerHeight));
    }
    setTagDropOpen(true);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setUploading(c => c + files.length);
    for (const file of Array.from(files)) {
      try {
        const up = await storageApi.upload(file, 'tasks');
        addedKeysRef.current.push(up.key);
        setAttachments(prev => [...prev, { name: up.name, url: up.url, type: up.type, size: up.size, key: up.key }]);
      } catch (e) {
        console.error('upload failed', e);
      } finally {
        setUploading(c => c - 1);
      }
    }
  };

  const removeAttachment = (idx: number) => {
    const a = attachments[idx];
    setAttachments(prev => prev.filter((_, i) => i !== idx));
    if (a.key) {
      const addIdx = addedKeysRef.current.indexOf(a.key);
      if (addIdx >= 0) {
        addedKeysRef.current.splice(addIdx, 1);
        storageApi.remove(a.key, 'tasks').catch(() => { /* ignore */ });
      } else {
        removedKeysRef.current.push(a.key);
      }
    }
  };

  const handleSubmit = async () => {
    const t = title.trim();
    if (!t) { titleRef.current?.focus(); return; }
    for (const k of removedKeysRef.current) {
      try { await storageApi.remove(k, 'tasks'); } catch { /* ignore */ }
    }
    removedKeysRef.current = [];
    addedKeysRef.current   = [];
    onSave({
      id:          initial?.id ?? uid(),
      kind:        'subtask',
      title:       t,
      description: description.trim() || undefined,
      done:        initial?.done ?? false,
      time:        time || undefined,
      tagId:       tagId ?? undefined,
      attachments: attachments.length ? attachments : undefined,
      days:        resolveDays(),
    });
  };

  const handleCancel = async () => {
    for (const k of addedKeysRef.current) {
      try { await storageApi.remove(k, 'tasks'); } catch { /* ignore */ }
    }
    addedKeysRef.current   = [];
    removedKeysRef.current = [];
    onCancel();
  };

  return (
    <Modal
      open
      onClose={handleCancel}
      size="md"
      title={initial?.id ? 'Изменить подзадачу' : 'Новая подзадача'}
      footer={
        <>
          <Button variant="secondary" onClick={handleCancel}>Отмена</Button>
          <Button
            variant="accent"
            onClick={handleSubmit}
            disabled={!title.trim() || uploading > 0}
            loading={uploading > 0}
          >
            {initial?.id ? 'Сохранить' : 'Добавить подзадачу'}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <Textarea
          ref={titleRef}
          value={title}
          onChange={e => setTitle(cap(e.target.value))}
          placeholder="Название подзадачи"
          rows={1}
          autoComplete="off"
          autoCorrect="off"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
        />
        <Textarea
          value={description}
          onChange={e => setDescription(cap(e.target.value))}
          placeholder="Описание подзадачи"
          autoComplete="off"
          autoCorrect="off"
          rows={2}
        />

        {isSeries && (
          <div className={styles.dayScope}>
            <span className={styles.dayScopeLabel}>Применить к дням</span>
            <div className={styles.dayScopeRadios}>
              {([
                ['this', 'Только этот день'],
                ['all',  'Все дни серии'],
                ['select', 'Выбранные дни'],
              ] as [DayScope, string][]).map(([val, label]) => (
                <label key={val} className={styles.dayScopeRadio}>
                  <input
                    type="radio"
                    name="dayScope"
                    checked={dayScope === val}
                    onChange={() => setDayScope(val)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            {dayScope === 'select' && (
              <div className={styles.dayChips}>
                {seriesDays!.map(ds => {
                  const active = selectedDays.includes(ds);
                  return (
                    <button
                      key={ds}
                      type="button"
                      className={[styles.dayChip, active ? styles.dayChipActive : ''].join(' ')}
                      onClick={() => toggleDay(ds)}
                    >
                      {fmtDay(ds)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {(attachments.length > 0 || uploading > 0) && (
          <div className={styles.attachGrid}>
            {attachments.map((a, i) => (
              <div key={i} className={styles.attachItem}>
                {a.type.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element -- загруженное вложение, оптимизация next/image не нужна
                  <img src={a.url} alt={a.name} className={styles.attachMedia} />
                ) : a.type.startsWith('video/') ? (
                  <video src={a.url} className={styles.attachMedia} muted />
                ) : (
                  <div className={styles.attachFile}><FileIcon size={24} strokeWidth={1.5} /></div>
                )}
                <div className={styles.attachName} title={a.name}>{a.name}</div>
                <button
                  type="button"
                  className={styles.attachRm}
                  onClick={() => removeAttachment(i)}
                  aria-label="Удалить вложение"
                >
                  ×
                </button>
              </div>
            ))}
            {Array.from({ length: uploading }).map((_, i) => (
              <div key={`up-${i}`} className={[styles.attachItem, styles.attachUploading].join(' ')}>
                <div className={styles.attachFile}>…</div>
                <div className={styles.attachName}>Загрузка…</div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.chips}>
          <TimePickerField
            value={time}
            endValue=""
            taskDate={parentDate}
            hideEnd
            onChange={setTime}
            onChangeEnd={() => { /* subtasks have only a start time */ }}
          />

          {userTags.length > 0 && (
            <>
              <button
                ref={tagBtnRef}
                type="button"
                className={[styles.chip, selectedTag ? styles.chipActive : ''].join(' ')}
                onClick={openTagDrop}
                style={selectedTag ? { borderColor: selectedTag.color, color: selectedTag.color } : undefined}
              >
                {selectedTag ? (
                  hasIcon(selectedTag.icon)
                    ? <Icon name={selectedTag.icon} size={13} strokeWidth={2} />
                    : <span className={styles.tagDot} style={{ background: selectedTag.color }} />
                ) : '#'}
                {selectedTag ? selectedTag.name : 'Тег'}
              </button>
              <AnimatePresence>
              {tagDropOpen && tagDropPos && (
                <motion.div
                  ref={tagDropRef}
                  className={styles.tagDropdown}
                  style={{ top: tagDropPos.top, left: tagDropPos.left }}
                  variants={popLayer}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <button
                    type="button"
                    className={[styles.tagDropItem, !tagId ? styles.tagDropItemActive : ''].join(' ')}
                    onClick={() => { setTagId(null); setTagDropOpen(false); }}
                  >
                    <span className={styles.tagDropDotNone} />
                    <span className={styles.tagDropName}>Без тега</span>
                    {!tagId && <span className={styles.tagDropCheck}>✓</span>}
                  </button>
                  {userTags.map(t => {
                    const active = tagId === t.id;
                    return (
                      <button key={t.id} type="button"
                        className={[styles.tagDropItem, active ? styles.tagDropItemActive : ''].join(' ')}
                        onClick={() => { setTagId(t.id); setTagDropOpen(false); }}
                      >
                        <span className={styles.tagDropDot} style={{ background: t.color }} />
                        {hasIcon(t.icon) && <Icon name={t.icon} size={11} strokeWidth={2} />}
                        <span className={styles.tagDropName}>{t.name}</span>
                        {active && <span className={styles.tagDropCheck}>✓</span>}
                      </button>
                    );
                  })}
                </motion.div>
              )}
              </AnimatePresence>
            </>
          )}

          <button type="button" className={styles.chip} onClick={() => fileRef.current?.click()}>
            <Paperclip size={13} strokeWidth={1.75} /> Вложение
          </button>

          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ACCEPT}
            style={{ display: 'none' }}
            onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
          />
        </div>
      </div>
    </Modal>
  );
}
