'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Bell } from 'lucide-react';
import { Task, TaskRepeat, TaskType, TaskPriority, TaskDifficulty, RepeatConfig, SubtaskSection, ReminderRule, toDateStr, getSeriesDays } from '../../../lib/tasks';
import { DatePickerPopup, getDateButtonLabel } from '../date-picker';
import { RepeatConfigModal } from '../repeat-config';
import { TimePickerField } from '../TimePickerField';
import type { Tag } from '../../../lib/tags';
import { Modal, Button, IconButton } from '../../../components/ui';
import { Icon, hasIcon } from '../../../lib/icons';
import { buildTaskPayload } from '../../../lib/taskFormPayload';
import {
  PRIORITY_LABELS, PRIORITY_COLORS, DIFFICULTY_LABELS, DIFFICULTY_COLORS,
} from './constants';
import { useTaskDraft } from '../../../hooks/useTaskDraft';
import { useAnchoredDropdown } from '../../../hooks/useAnchoredDropdown';
import { useOptimisticTagCreate } from '../../../hooks/useOptimisticTagCreate';
import { WeatherWidget } from './WeatherWidget';
import { WeatherDetailModal } from './WeatherDetailModal';
import { SubtaskSectionComp } from './SubtaskSection';
import { MetaDropdowns } from './MetaDropdowns';
import { ReminderDropdown } from './ReminderDropdown';
import { registerPush } from '../../../lib/push';
import styles from './TaskFormModal.module.scss';

const uid = () => Math.random().toString(36).slice(2, 10);

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
  const { draft, save: saveDraftFields, clear: clearDraft } = useTaskDraft(initialDate, isEdit);

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
  // «Дедлайн» = type 'mandatory'; «Эвент» (админ) = type 'event'; иначе 'normal'.
  const [deadline,      setDeadline]      = useState(task ? task.type === 'mandatory' : (draft?.deadline ?? draft?.type === 'mandatory'));
  const [isEvent,       setIsEvent]       = useState(task?.type === 'event');
  const [priority,      setPriority]      = useState<TaskPriority>(task?.priority ?? draft?.priority ?? 'none');
  const [difficulty,    setDifficulty]    = useState<TaskDifficulty>(task?.difficulty ?? draft?.difficulty ?? 'normal');
  const [repeatConfig,    setRepeatConfig]    = useState<RepeatConfig | null>(task?.repeatConfig ?? null);
  const [selectedTagId,   setSelectedTagId]   = useState<string | null>(task?.tags?.[0]?.id ?? draft?.tagId ?? null);
  const [reminders,       setReminders]       = useState<ReminderRule[]>(task?.reminders ?? draft?.reminders ?? []);
  const [datePickerOpen,  setDatePickerOpen]  = useState(false);
  const [repeatConfigOpen, setRepeatConfigOpen] = useState(false);
  // Дата открытого подробного прогноза (null — модалка закрыта). Состояние
  // поднято в форму, чтобы оба инстанса WeatherWidget (моб./десктоп) делили одну модалку.
  const [weatherDetailDate, setWeatherDetailDate] = useState<string | null>(null);
  const [creatingTag,      setCreatingTag]      = useState(false);
  const dateBtnRef      = useRef<HTMLButtonElement>(null);

  const {
    open: tagDropOpen, pos: tagDropPos, toggle: toggleTagDrop, close: closeTagDrop,
    anchorRef: tagBtnRef, popoverRef: tagDropRef,
  } = useAnchoredDropdown({ width: 220, height: 240, onClose: () => setCreatingTag(false) });
  const {
    open: priorityDropOpen, pos: priorityDropPos, toggle: togglePriorityDrop, close: closePriorityDrop,
    anchorRef: priorityBtnRef, popoverRef: priorityDropRef,
  } = useAnchoredDropdown();
  const {
    open: difficultyDropOpen, pos: difficultyDropPos, toggle: toggleDifficultyDrop, close: closeDifficultyDrop,
    anchorRef: difficultyBtnRef, popoverRef: difficultyDropRef,
  } = useAnchoredDropdown({ height: 240 });
  const {
    open: reminderDropOpen, pos: reminderDropPos, toggle: toggleReminderDrop,
    anchorRef: reminderBtnRef, popoverRef: reminderDropRef,
  } = useAnchoredDropdown({ width: 280, height: 380 });

  const { allTags, selectedTag, createTag, awaitPendingCreate } =
    useOptimisticTagCreate(userTags, selectedTagId, setSelectedTagId, onCreateTag);

  const [sections,      setSections]      = useState<SubtaskSection[]>(() => {
    if (task?.subtasks && task.subtasks.length > 0) return task.subtasks;
    if (draft?.sections && draft.sections.length > 0) return draft.sections;
    return makeDefaultSections();
  });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Автофокус только на устройствах с «точным» указателем (десктоп).
    // На тач-устройствах не фокусируем — иначе при открытии задачи сразу
    // лезет клавиатура; пользователь сам нажмёт на поле для редактирования.
    if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches) {
      titleRef.current?.focus();
    }
  }, []);

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
    setPriority('none'); setDifficulty('normal'); setDeadline(false); setIsEvent(false);
    setRepeat('none'); setHasEnd(false); setRepeatUntil('');
    setRepeatConfig(null); setSelectedTagId(null);
    setFormDate(initialDate);
    setMultiDay(false);
    setEndDate('');
    setSections(makeDefaultSections());
    setReminders([]);
    clearDraft();
  };

  // Тип задачи выводится из флагов: «Эвент» (админ) → event, «Дедлайн» → mandatory.
  const type: TaskType = isEvent ? 'event' : deadline ? 'mandatory' : 'normal';

  useEffect(() => {
    if (isEdit || !title.trim()) return;
    saveDraftFields({
      title, description, time, endTime, multiDay, endDate,
      repeat, hasEnd, repeatUntil, type, priority, difficulty, deadline, tagId: selectedTagId,
      sections, reminders,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, time, endTime, multiDay, endDate, repeat, hasEnd, repeatUntil, type, priority, difficulty, deadline, selectedTagId, sections, reminders, isEdit, initialDate]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const toggleTag = (id: string) => setSelectedTagId(prev => prev === id ? null : id);

  const handleSelectPriority = (p: TaskPriority) => { setPriority(p); closePriorityDrop(); };

  const handleSelectDifficulty = (d: TaskDifficulty) => { setDifficulty(d); closeDifficultyDrop(); };

  // Дедлайн (mandatory) несовместим с многодневностью — гасим её при включении.
  const toggleDeadline = () => {
    setDeadline(prev => {
      const next = !prev;
      if (next && multiDay) { setMultiDay(false); setEndDate(''); }
      return next;
    });
  };

  const toggleEvent = () => setIsEvent(prev => !prev);

  const handleSelectTag = (id: string | null) => {
    if (id === null) setSelectedTagId(null);
    else toggleTag(id);
    closeTagDrop();
  };

  const openTagDrop = () => {
    setCreatingTag(false);
    toggleTagDrop();
  };

  // Optimistic tag creation: shows tag immediately, syncs with server in background
  const handleCreateNewTag = (data: { name: string; icon: string | null; color: string }) => {
    createTag(data, () => { setCreatingTag(false); closeTagDrop(); });
  };

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

  // День, для которого открыт редактор (для области «дни» подзадач).
  const currentDay = task?.occurrenceDate ?? formDate;
  // Дни серии для выбора области подзадачи. Считаем из текущих значений формы,
  // чтобы работало и при создании, и при редактировании.
  const seriesDays = useMemo(
    () => getSeriesDays({
      date:        formDate,
      endDate:     multiDay && endDate && endDate > formDate ? endDate : undefined,
      repeat,
      repeatUntil: repeat !== 'none' && hasEnd && repeatUntil ? repeatUntil : undefined,
      repeatConfig,
    }, task?.dayOverrides),
    [formDate, multiDay, endDate, repeat, hasEnd, repeatUntil, repeatConfig, task?.dayOverrides],
  );

  const toggleCollapse = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    // If a temp tag is selected and still pending, wait for the real ID
    await awaitPendingCreate();
    if (!isEdit) clearDraft();

    const payload = buildTaskPayload({
      title, description, formDate, multiDay, endDate, time, endTime,
      repeat, hasEnd, repeatUntil, type, priority, difficulty, repeatConfig, selectedTag, sections, reminders,
    });

    onSave(payload);
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
          <WeatherWidget date={isEdit ? toDateStr(date) : formDate} variant="compact" onOpenDetail={setWeatherDetailDate} />
        </div>

        {/* ── Top: иконка + название + описание + мета-поля + теги ── */}
        <div className={styles.top}>
          <div className={styles.titleRow}>
            {hasIcon(selectedTag?.icon) && (
              <span className={styles.taskIconPreview} style={{ color: selectedTag?.color }}>
                <Icon name={selectedTag?.icon} size={20} strokeWidth={1.75} />
              </span>
            )}
            {/* textarea (1 строка) вместо input: мобильные браузеры (напр. Yandex)
                игнорируют autocomplete=off у input и показывают панель автозаполнения
                над клавиатурой; у textarea её нет. */}
            <textarea
              ref={titleRef}
              className={styles.titleInput}
              value={title}
              onChange={e => setTitle(cap(e.target.value))}
              placeholder="Название задачи"
              rows={1}
              autoComplete="off"
              autoCorrect="off"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
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
            autoComplete="off"
            autoCorrect="off"
            rows={2}
            // Enter закрывает клавиатуру (перенос строки — через Shift+Enter)
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } }}
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
              onClick={togglePriorityDrop}
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

            {/* Сложность (+ дедлайн/эвент внутри дропдауна) */}
            <button
              ref={difficultyBtnRef}
              type="button"
              className={[styles.metaBtn, difficulty !== 'normal' ? styles.metaBtnColored : ''].join(' ')}
              style={difficulty !== 'normal' ? { color: DIFFICULTY_COLORS[difficulty], borderColor: DIFFICULTY_COLORS[difficulty] + '55' } : {}}
              onClick={toggleDifficultyDrop}
            >
              {difficulty !== 'normal' && <span className={styles.metaBtnDot} style={{ background: DIFFICULTY_COLORS[difficulty] }} />}
              {DIFFICULTY_LABELS[difficulty]}
              {deadline && <span className={styles.metaBtnFlag} title="Дедлайн">⚑</span>}
            </button>

            {/* Напоминание */}
            <button
              ref={reminderBtnRef}
              type="button"
              className={[styles.metaBtn, reminders.length ? styles.metaBtnColored : ''].join(' ')}
              onClick={toggleReminderDrop}
            >
              <Bell size={14} strokeWidth={1.75} />
              {reminders.length ? `Напоминание · ${reminders.length}` : 'Напоминание'}
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
                  seriesDays={seriesDays}
                  currentDay={currentDay}
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
              <WeatherWidget date={isEdit ? toDateStr(date) : formDate} variant="full" onOpenDetail={setWeatherDetailDate} />
            </div>
          </div>

          {/* Footer */}
          <div className={styles.footer}>
            <div className={styles.footerLeft}>
              {isEdit && onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.deleteBtn}
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
              <Button variant="secondary" size="sm" onClick={onClose}>Отмена</Button>
              <Button variant="accent" size="sm" type="submit" disabled={!title.trim()}>
                {isEdit ? 'Сохранить' : 'Создать'}
              </Button>
            </div>
          </div>
        </form>
    </Modal>

    <MetaDropdowns
      priority={priority}
      priorityDropOpen={priorityDropOpen}
      priorityDropPos={priorityDropPos}
      priorityDropRef={priorityDropRef}
      onSelectPriority={handleSelectPriority}
      difficulty={difficulty}
      difficultyDropOpen={difficultyDropOpen}
      difficultyDropPos={difficultyDropPos}
      difficultyDropRef={difficultyDropRef}
      onSelectDifficulty={handleSelectDifficulty}
      deadline={deadline}
      isEvent={isEvent}
      isAdmin={isAdmin}
      onToggleDeadline={toggleDeadline}
      onToggleEvent={toggleEvent}
      selectedTagId={selectedTagId}
      allTags={allTags}
      tagDropOpen={tagDropOpen}
      tagDropPos={tagDropPos}
      tagDropRef={tagDropRef}
      onSelectTag={handleSelectTag}
      creatingTag={creatingTag}
      onStartCreatingTag={() => setCreatingTag(true)}
      onCreateTag={handleCreateNewTag}
    />

    <ReminderDropdown
      reminders={reminders}
      onChange={setReminders}
      hasTime={!!time}
      minDate={toDateStr(new Date())}
      open={reminderDropOpen}
      pos={reminderDropPos}
      dropRef={reminderDropRef}
      onFirstAdd={() => { void registerPush(); }}
    />

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

    <WeatherDetailModal
      date={weatherDetailDate}
      condition={repeatConfig?.weatherCondition}
      hasTime={!!time}
      onPickTime={(d, h) => {
        setFormDate(d);
        setTime(`${String(h).padStart(2, '0')}:00`);
        setWeatherDetailDate(null);
      }}
      onClose={() => setWeatherDetailDate(null)}
    />
  </>
  );
}
