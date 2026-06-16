'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Plus, X, Check } from 'lucide-react';
import { BoardColumn as Col, BoardCard, toUnits, columnColor, COLUMN_COLORS } from '../../../lib/board';
import { SortableCard, GroupUnit, DragData } from './BoardCard';
import styles from './BoardView.module.scss';

interface Props {
  column: Col;
  cards: BoardCard[];
  onRename: (name: string) => void;
  onSetColor: (color: string) => void;
  onDelete?: () => void;
  onOpenTask: (card: BoardCard) => void;
  onOpenSubtask: (card: BoardCard) => void;
  onAdd: (title: string) => void;
}

export function BoardColumn({ column, cards, onRename, onSetColor, onDelete, onOpenTask, onOpenSubtask, onAdd }: Props) {
  const colData: DragData = { kind: 'column', columnId: column.id, label: column.name };
  const { setNodeRef, listeners, attributes, transform, transition, isDragging } =
    useSortable({ id: `col:${column.id}`, data: colData });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `body:${column.id}`, data: { columnId: column.id } });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(column.name);
  const nameRef = useRef<HTMLInputElement>(null);

  const [adding, setAdding] = useState(false);
  const [addText, setAddText] = useState('');
  const addRef = useRef<HTMLInputElement>(null);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (editing) nameRef.current?.select(); }, [editing]);
  useEffect(() => { if (adding) addRef.current?.focus(); }, [adding]);
  useEffect(() => {
    if (!paletteOpen) return;
    const h = (e: MouseEvent) => { if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) setPaletteOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [paletteOpen]);

  const color = columnColor(column);

  const commitName = () => {
    const n = draft.trim();
    if (n && n !== column.name) onRename(n); else setDraft(column.name);
    setEditing(false);
  };
  const submitAdd = () => {
    const t = addText.trim();
    if (t) { onAdd(t); setAddText(''); }
  };

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };
  const items = useMemo(() => cards.map(c => c.key), [cards]);
  const units = useMemo(() => toUnits(cards), [cards]);

  return (
    <div ref={setNodeRef} style={style} className={[styles.column, isDragging ? styles.columnDragging : ''].join(' ')}>
      <div className={styles.columnHead} {...listeners} {...attributes}>
        <div className={styles.colorWrap} ref={paletteRef}>
          <button type="button" className={styles.colorDot} style={{ background: color }}
            onPointerDown={e => e.stopPropagation()} onClick={() => setPaletteOpen(v => !v)}
            aria-label="Цвет колонки" />
          {paletteOpen && (
            <div className={styles.palette}>
              {COLUMN_COLORS.map(hex => (
                <button key={hex} type="button"
                  className={[styles.swatch, hex === color ? styles.swatchActive : ''].join(' ')}
                  style={{ background: hex }}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => { onSetColor(hex); setPaletteOpen(false); }} />
              ))}
            </div>
          )}
        </div>

        {editing ? (
          <input
            ref={nameRef}
            className={styles.columnNameInput}
            value={draft}
            maxLength={40}
            onPointerDown={e => e.stopPropagation()}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setDraft(column.name); setEditing(false); } }}
          />
        ) : (
          <span className={styles.columnName} style={{ background: `${color}26`, color }}
            onDoubleClick={() => { setDraft(column.name); setEditing(true); }} title="Двойной клик — переименовать">
            {column.name}
          </span>
        )}
        <span className={styles.columnCount}>{cards.length}</span>
        {onDelete && (
          <button type="button" className={styles.columnDelete}
            onPointerDown={e => e.stopPropagation()} onClick={onDelete} aria-label="Удалить колонку">
            <X size={14} strokeWidth={2} />
          </button>
        )}
      </div>

      <div ref={setDropRef} className={[styles.columnBody, isOver ? styles.columnBodyOver : ''].join(' ')}>
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          {units.map(u => {
            if (u.kind === 'group') {
              return (
                <GroupUnit key={u.id} task={u.task} cards={u.cards} columnId={column.id}
                  onOpenTask={() => onOpenTask(u.cards[0])}
                  onOpenSubtask={(c) => onOpenSubtask(c)} />
              );
            }
            const card = u.cards[0];
            return (
              <SortableCard key={card.key} card={card}
                onOpen={() => (card.kind === 'task' ? onOpenTask(card) : onOpenSubtask(card))} />
            );
          })}
        </SortableContext>

        {adding ? (
          <div className={styles.addRow}>
            <input
              ref={addRef}
              className={styles.addInput}
              value={addText}
              placeholder="Название задачи…"
              onChange={e => setAddText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submitAdd();
                if (e.key === 'Escape') { setAddText(''); setAdding(false); }
              }}
              onBlur={() => { if (!addText.trim()) setAdding(false); }}
            />
            <button type="button" className={styles.addConfirm} onClick={submitAdd} aria-label="Создать"><Check size={15} strokeWidth={2.5} /></button>
          </div>
        ) : (
          <button type="button" className={styles.addBtn} onClick={() => setAdding(true)}>
            <Plus size={15} strokeWidth={2} /> Создать
          </button>
        )}
      </div>
    </div>
  );
}
