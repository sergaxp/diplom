'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Task, TaskRepeat, TaskType, SubtaskSection, SubtaskItem, toDateStr } from '../../lib/tasks';
import type { Tag } from '../../lib/tags';
import { useDayWeather, weatherCodeToInfo } from '../../lib/weather';
import { useAuthStore } from '../../store/authStore';
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
  title: string; time: string; endTime: string;
  repeat: TaskRepeat; hasEnd: boolean; repeatUntil: string;
  type: TaskType; tagId: string | null; multiDay: boolean; endDate: string;
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
  none: 'Без повтора', daily: 'Каждый день',
  weekly: 'Каждую неделю', monthly: 'Каждый месяц', yearly: 'Каждый год',
};

const TYPE_LABELS: Record<TaskType, string> = {
  normal: 'Обычная', mandatory: 'Обязательная', event: 'Эвент',
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
        {SunIcon && weather.uvIndex > 0 && (
          <div className={styles.weatherRow}>
            <SunIcon size={12} strokeWidth={1.75} />
            <span>УФ-индекс</span>
            <span className={styles.weatherRowVal}>{weather.uvIndex}</span>
          </div>
        )}
        {DropIcon && (
          <div className={styles.weatherRow}>
            <DropIcon size={12} strokeWidth={1.75} />
            <span>Локация</span>
            <span className={styles.weatherRowVal} style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.location ?? 'Челябинск'}
            </span>
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
  onToggleCollapse: () => void;
  onChange: (s: SubtaskSection) => void;
  onDelete: () => void;
}

function SubtaskSectionComp({ section, collapsed, canDelete, onToggleCollapse, onChange, onDelete }: SectionProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal,     setTitleVal]     = useState(section.title);
  const [addVal,       setAddVal]       = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const addInputRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.select();
  }, [editingTitle]);

  const commitTitle = () => {
    setEditingTitle(false);
    const t = titleVal.trim() || section.title;
    setTitleVal(t);
    onChange({ ...section, title: t });
  };

  const toggleItem = (itemId: string) =>
    onChange({ ...section, items: section.items.map(it => it.id === itemId ? { ...it, done: !it.done } : it) });

  const renameItem = (itemId: string, title: string) =>
    onChange({ ...section, items: section.items.map(it => it.id === itemId ? { ...it, title } : it) });

  const deleteItem = (itemId: string) =>
    onChange({ ...section, items: section.items.filter(it => it.id !== itemId) });

  const addItem = () => {
    const t = addVal.trim();
    if (!t) return;
    const newItem: SubtaskItem = { id: uid(), title: t, done: false };
    onChange({ ...section, items: [...section.items, newItem] });
    setAddVal('');
  };

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

      {!collapsed && (
        <ul className={styles.subtaskList}>
          {section.items.map(item => (
            <li key={item.id} className={[styles.subtaskItem, item.done ? styles.subtaskItemDone : ''].join(' ')}>
              <button
                type="button"
                className={[styles.subtaskCheck, item.done ? styles.subtaskCheckDone : ''].join(' ')}
                onClick={() => toggleItem(item.id)}
              >
                {item.done && '✓'}
              </button>
              <input
                className={styles.subtaskItemInput}
                value={item.title}
                onChange={e => renameItem(item.id, e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addInputRef.current?.focus(); } }}
              />
              <button type="button" className={styles.subtaskDeleteBtn} onClick={() => deleteItem(item.id)}>×</button>
            </li>
          ))}
          <li className={styles.addSubtask}>
            <span className={styles.addSubtaskPlus}>+</span>
            <input
              ref={addInputRef}
              className={styles.addSubtaskInput}
              placeholder="Добавить подзадачу..."
              value={addVal}
              onChange={e => setAddVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); addItem(); }
                if (e.key === 'Escape') setAddVal('');
              }}
            />
          </li>
        </ul>
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
}

export function TaskFormModal({ task, date, isAdmin, userTags, onSave, onClose, onDelete }: Props) {
  const isEdit      = !!task;
  const initialDate = useMemo(() => toDateStr(date), [date]);
  const draft       = useMemo(() => (!isEdit ? loadDraft(initialDate) : null), [isEdit, initialDate]);

  const makeDefaultSections = (): SubtaskSection[] => [{ id: uid(), title: 'Основное', items: [] }];

  const [title,         setTitle]         = useState(task?.title       ?? draft?.title       ?? '');
  const [formDate,      setFormDate]      = useState(task?.date        ?? initialDate);
  const [time,          setTime]          = useState(task?.time        ?? draft?.time        ?? '');
  const [endTime,       setEndTime]       = useState(task?.endTime     ?? draft?.endTime     ?? '');
  const [multiDay,      setMultiDay]      = useState(task?.type !== 'mandatory' && !!(task?.endDate ?? draft?.multiDay));
  const [endDate,       setEndDate]       = useState(task?.endDate     ?? draft?.endDate     ?? '');
  const [repeat,        setRepeat]        = useState<TaskRepeat>(task?.repeat ?? draft?.repeat ?? 'none');
  const [hasEnd,        setHasEnd]        = useState(task ? !!task.repeatUntil : (draft?.hasEnd ?? false));
  const [repeatUntil,   setRepeatUntil]   = useState(task?.repeatUntil ?? draft?.repeatUntil ?? '');
  const [type,          setType]          = useState<TaskType>(task?.type ?? draft?.type ?? 'normal');
  const [selectedTagId, setSelectedTagId] = useState<string | null>(task?.tags?.[0]?.id ?? draft?.tagId ?? null);
  const [sections,      setSections]      = useState<SubtaskSection[]>(() => {
    if (task?.subtasks && task.subtasks.length > 0) return task.subtasks;
    if (draft?.sections && draft.sections.length > 0) return draft.sections;
    return makeDefaultSections();
  });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  useEffect(() => {
    if (isEdit || !title.trim()) return;
    saveDraft(initialDate, {
      title, time, endTime, multiDay, endDate,
      repeat, hasEnd, repeatUntil, type, tagId: selectedTagId,
      sections, savedAt: Date.now(),
    });
  }, [title, time, endTime, multiDay, endDate, repeat, hasEnd, repeatUntil, type, selectedTagId, sections, isEdit, initialDate]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const selectedTag = selectedTagId ? userTags.find(t => t.id === selectedTagId) : undefined;
  const TagIcon     = selectedTag?.icon ? Icons[selectedTag.icon] : null;

  const toggleTag = (id: string) => setSelectedTagId(prev => prev === id ? null : id);

  const updateSection = (idx: number, s: SubtaskSection) =>
    setSections(prev => prev.map((sec, i) => i === idx ? s : sec));

  const deleteSection = (idx: number) =>
    setSections(prev => prev.filter((_, i) => i !== idx));

  const addSection = () =>
    setSections(prev => [...prev, { id: uid(), title: 'Новый раздел', items: [] }]);

  const toggleCollapse = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const availableTypes: TaskType[] = isAdmin
    ? ['normal', 'mandatory', 'event']
    : ['normal', 'mandatory'];

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    if (!isEdit) clearDraft(initialDate);

    const resolvedEndDate = multiDay && endDate && endDate > formDate ? endDate : undefined;

    onSave({
      title:       trimmed,
      description: undefined,
      date:        formDate,
      endDate:     resolvedEndDate,
      time:        time || undefined,
      endTime:     (time && endTime && endTime > time) ? endTime : undefined,
      repeat,
      repeatUntil: (repeat !== 'none' && hasEnd && repeatUntil) ? repeatUntil : undefined,
      type,
      icon:        selectedTag?.icon ?? null,
      tags:        selectedTag ? [selectedTag] : [],
      subtasks:    sections,
    });
    onClose();
  };

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>

        {/* ── Top: иконка + название + закрыть ────────────── */}
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
              onChange={e => setTitle(e.target.value)}
              placeholder="Название задачи"
            />
            <button className={styles.closeBtn} onClick={onClose} type="button" aria-label="Закрыть">✕</button>
          </div>

          {/* Теги — под названием */}
          {userTags.length > 0 && (
            <div className={styles.tagPicker}>
              {userTags.map(tag => {
                const Ic     = tag.icon ? Icons[tag.icon] : null;
                const active = selectedTagId === tag.id;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={[styles.tagPill, active ? styles.tagPillActive : ''].join(' ')}
                    style={active ? { borderColor: tag.color, background: tag.color + '20', color: tag.color } : {}}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {Ic && <Ic size={10} strokeWidth={2} />}
                    {tag.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className={styles.formWrap}>
          <div className={styles.body}>

            {/* LEFT — подзадачи */}
            <div className={styles.left}>
              {sections.map((sec, idx) => (
                <SubtaskSectionComp
                  key={sec.id}
                  section={sec}
                  collapsed={collapsed.has(sec.id)}
                  canDelete={sections.length > 1}
                  onToggleCollapse={() => toggleCollapse(sec.id)}
                  onChange={s => updateSection(idx, s)}
                  onDelete={() => deleteSection(idx)}
                />
              ))}
              <button type="button" className={styles.addSectionBtn} onClick={addSection}>
                + Добавить раздел
              </button>
            </div>

            {/* RIGHT — погода + настройки */}
            <div className={styles.right}>

              {/* Погода: при редактировании — по дню, с которого открыт календарь;
                  при создании — по выбранной дате начала задачи */}
              <WeatherWidget date={isEdit ? toDateStr(date) : formDate} />

              {/* Дата */}
              <div className={styles.field}>
                <div className={styles.fieldHead}>
                  <label className={styles.fieldLabel}>Дата</label>
                  {type !== 'mandatory' && (
                    <button
                      type="button"
                      className={styles.rangeToggle}
                      onClick={() => { setMultiDay(v => !v); if (multiDay) setEndDate(''); }}
                    >
                      {multiDay ? '← Один день' : '+ Несколько дней'}
                    </button>
                  )}
                </div>
                {multiDay ? (
                  <div className={styles.rangeRow}>
                    <input className={styles.input} type="date" value={formDate}
                      onChange={e => setFormDate(e.target.value)} required />
                    <span className={styles.sep}>—</span>
                    <input className={styles.input} type="date" value={endDate}
                      min={formDate} onChange={e => setEndDate(e.target.value)} />
                  </div>
                ) : (
                  <input className={styles.input} type="date" value={formDate}
                    onChange={e => setFormDate(e.target.value)} required />
                )}
              </div>

              {/* Время */}
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Время</label>
                <div className={styles.rangeRow}>
                  <input className={styles.input} type="time" value={time}
                    onChange={e => { setTime(e.target.value); if (!e.target.value) setEndTime(''); }} />
                  {time && (
                    <>
                      <span className={styles.sep}>—</span>
                      <input className={styles.input} type="time" value={endTime}
                        onChange={e => setEndTime(e.target.value)} />
                    </>
                  )}
                </div>
              </div>

              {/* Повтор */}
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Повтор</label>
                <select className={styles.select} value={repeat}
                  onChange={e => setRepeat(e.target.value as TaskRepeat)}>
                  {(Object.keys(REPEAT_LABELS) as TaskRepeat[]).map(r => (
                    <option key={r} value={r}>{REPEAT_LABELS[r]}</option>
                  ))}
                </select>
                {repeat !== 'none' && (
                  <div className={styles.repeatUntil}>
                    <label className={styles.checkLabel}>
                      <input type="checkbox" checked={hasEnd} onChange={e => setHasEnd(e.target.checked)} />
                      Ограничить по дате
                    </label>
                    {hasEnd && (
                      <input className={styles.input} type="date" value={repeatUntil}
                        min={formDate} onChange={e => setRepeatUntil(e.target.value)} />
                    )}
                  </div>
                )}
              </div>

              {/* Тип */}
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Тип</label>
                <select className={styles.select} value={type}
                  onChange={e => {
                    const newType = e.target.value as TaskType;
                    setType(newType);
                    if (newType === 'mandatory' && multiDay) { setMultiDay(false); setEndDate(''); }
                  }}>
                  {availableTypes.map(t => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>

            </div>
          </div>

          {/* Footer */}
          <div className={styles.footer}>
            <div className={styles.footerLeft}>
              {isEdit && onDelete && (
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => { onDelete(); onClose(); }}
                >
                  Удалить
                </button>
              )}
            </div>
            <div className={styles.footerRight}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>Отмена</button>
              <button type="submit" className={styles.submitBtn} disabled={!title.trim()}>
                {isEdit ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}
