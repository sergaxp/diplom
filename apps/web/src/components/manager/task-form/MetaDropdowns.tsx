'use client';

import type { RefObject } from 'react';
import { TaskType, TaskPriority } from '../../../lib/tasks';
import type { Tag } from '../../../lib/tags';
import { Icon, hasIcon } from '../../../lib/icons';
import { TagManager } from '../TagManager';
import { PRIORITY_LABELS, PRIORITY_COLORS, TYPE_LABELS, TYPE_COLORS } from './constants';
import styles from './TaskFormModal.module.scss';

interface Pos { top: number; left: number }

interface MetaDropdownsProps {
  priority: TaskPriority;
  priorityDropOpen: boolean;
  priorityDropPos: Pos | null;
  priorityDropRef: RefObject<HTMLDivElement | null>;
  onSelectPriority: (p: TaskPriority) => void;

  type: TaskType;
  availableTypes: TaskType[];
  typeDropOpen: boolean;
  typeDropPos: Pos | null;
  typeDropRef: RefObject<HTMLDivElement | null>;
  onSelectType: (t: TaskType) => void;

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
  type, availableTypes, typeDropOpen, typeDropPos, typeDropRef, onSelectType,
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
              onClick={() => onSelectType(t)}
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
