'use client';

import type { RefObject } from 'react';
import { TaskDifficulty, TaskPriority } from '../../../lib/tasks';
import type { Tag } from '../../../lib/tags';
import { Icon, hasIcon } from '../../../lib/icons';
import { TagManager } from '../TagManager';
import { PRIORITY_LABELS, PRIORITY_COLORS, DIFFICULTY_LABELS, DIFFICULTY_COLORS } from './constants';
import styles from './TaskFormModal.module.scss';

interface Pos { top: number; left: number }

interface MetaDropdownsProps {
  priority: TaskPriority;
  priorityDropOpen: boolean;
  priorityDropPos: Pos | null;
  priorityDropRef: RefObject<HTMLDivElement | null>;
  onSelectPriority: (p: TaskPriority) => void;

  difficulty: TaskDifficulty;
  difficultyDropOpen: boolean;
  difficultyDropPos: Pos | null;
  difficultyDropRef: RefObject<HTMLDivElement | null>;
  onSelectDifficulty: (d: TaskDifficulty) => void;
  deadline: boolean;
  isEvent: boolean;
  isAdmin: boolean;
  onToggleDeadline: () => void;
  onToggleEvent: () => void;

  selectedTagId: string | null;
  allTags: Tag[];
  tagDropOpen: boolean;
  tagDropPos: Pos | null;
  tagDropRef: RefObject<HTMLDivElement | null>;
  onSelectTag: (id: string | null) => void;
  creatingTag: boolean;
  onStartCreatingTag: () => void;
  onCreateTag: (data: { name: string; icon: string | null; color: string }) => void;
}

/** Поповеры выбора приоритета/типа/тега мета-полей формы задачи (на базе useAnchoredDropdown). */
export function MetaDropdowns({
  priority, priorityDropOpen, priorityDropPos, priorityDropRef, onSelectPriority,
  difficulty, difficultyDropOpen, difficultyDropPos, difficultyDropRef, onSelectDifficulty,
  deadline, isEvent, isAdmin, onToggleDeadline, onToggleEvent,
  selectedTagId, allTags, tagDropOpen, tagDropPos, tagDropRef, onSelectTag,
  creatingTag, onStartCreatingTag, onCreateTag,
}: MetaDropdownsProps) {
  return (
    <>
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
              onClick={() => onSelectPriority(p)}
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

      {difficultyDropOpen && difficultyDropPos && (
        <div
          ref={difficultyDropRef}
          className={styles.metaDropdown}
          style={{ top: difficultyDropPos.top, left: difficultyDropPos.left }}
          onMouseDown={e => e.stopPropagation()}
        >
          {(Object.keys(DIFFICULTY_LABELS) as TaskDifficulty[]).map(d => (
            <button
              key={d}
              type="button"
              className={[styles.metaDropItem, difficulty === d ? styles.metaDropItemActive : ''].join(' ')}
              onClick={() => onSelectDifficulty(d)}
            >
              <span className={styles.metaDropDot} style={{ background: DIFFICULTY_COLORS[d] }} />
              {DIFFICULTY_LABELS[d]}
              {difficulty === d && <span className={styles.metaDropCheck}>✓</span>}
            </button>
          ))}

          {/* Дедлайн / Эвент — чекбоксы под чертой */}
          <div className={styles.metaDropDivider} />
          <button
            type="button"
            role="checkbox"
            aria-checked={deadline}
            className={styles.metaDropToggle}
            onClick={onToggleDeadline}
          >
            <span className={[styles.metaDropBox, deadline ? styles.metaDropBoxOn : ''].join(' ')}>
              {deadline && '✓'}
            </span>
            Дедлайн
          </button>
          {isAdmin && (
            <button
              type="button"
              role="checkbox"
              aria-checked={isEvent}
              className={styles.metaDropToggle}
              onClick={onToggleEvent}
            >
              <span className={[styles.metaDropBox, isEvent ? styles.metaDropBoxOn : ''].join(' ')}>
                {isEvent && '✓'}
              </span>
              Эвент
            </button>
          )}
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
            onClick={() => onSelectTag(null)}
          >
            <span className={styles.tagDropDotNone} />
            <span className={styles.tagDropName}>Без тега</span>
            {!selectedTagId && <span className={styles.tagDropCheck}>✓</span>}
          </button>

          {allTags.map(tag => {
            const active = selectedTagId === tag.id;
            return (
              <button
                key={tag.id}
                type="button"
                className={[styles.tagDropItem, active ? styles.tagDropItemActive : ''].join(' ')}
                onClick={() => onSelectTag(tag.id)}
              >
                <span className={styles.tagDropDot} style={{ background: tag.color }} />
                {hasIcon(tag.icon) && <Icon name={tag.icon} size={11} strokeWidth={2} />}
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
              onClick={onStartCreatingTag}
            >
              + Создать тег
            </button>
          ) : (
            <div className={styles.tagCreateWrap}>
              <TagManager
                alwaysOpen
                tags={[]}
                onCreate={onCreateTag}
                onDelete={() => {}}
                onUpdate={() => {}}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
