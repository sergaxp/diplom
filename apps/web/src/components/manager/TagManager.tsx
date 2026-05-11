'use client';

import { useRef, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Tag } from '../../lib/tags';
import { IconPicker } from '../IconPicker';
import styles from './TagManager.module.scss';

type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number }>;
const Icons = LucideIcons as unknown as Record<string, LucideIcon>;

const DEFAULT_COLOR = '#4F46E5';

interface Props {
  tags: Tag[];
  alwaysOpen?: boolean;
  onCreate: (data: { name: string; icon: string | null; color: string }) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: { name?: string; icon?: string | null; color?: string }) => void;
}

export function TagManager({ tags, alwaysOpen, onCreate, onDelete, onUpdate }: Props) {
  const [open,      setOpen]      = useState(!!alwaysOpen);
  const [name,      setName]      = useState('');
  const [icon,      setIcon]      = useState('');
  const [color,     setColor]     = useState(DEFAULT_COLOR);
  const [hexInput,  setHexInput]  = useState(DEFAULT_COLOR);
  const [editingId, setEditingId] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const syncColor = (val: string) => {
    setColor(val);
    setHexInput(val);
  };

  const handleHexInput = (val: string) => {
    setHexInput(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) setColor(val);
  };

  const resetForm = () => {
    setEditingId(null);
    setName(''); setIcon('');
    syncColor(DEFAULT_COLOR);
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), icon: icon || null, color });
    setName(''); setIcon('');
    syncColor(DEFAULT_COLOR);
    nameRef.current?.focus();
  };

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setName(tag.name);
    setIcon(tag.icon ?? '');
    syncColor(tag.color);
  };

  const handleUpdate = () => {
    if (!editingId || !name.trim()) return;
    onUpdate(editingId, { name: name.trim(), icon: icon || null, color });
    resetForm();
  };

  return (
    <div className={styles.root}>
      {!alwaysOpen && (
        <button className={styles.toggle} onClick={() => setOpen(v => !v)}>
          <span>Теги</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
            className={[styles.chevron, open ? styles.chevronOpen : ''].join(' ')}>
            <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}

      {open && (
        <div className={styles.panel}>
          {/* Список тегов */}
          {tags.length > 0 && (
            <div className={styles.list}>
              {tags.map(tag => {
                const Ic = tag.icon ? Icons[tag.icon] : null;
                return (
                  <div key={tag.id} className={[styles.tagRow, editingId === tag.id ? styles.tagRowEditing : ''].join(' ')}>
                    <span className={styles.tagChip} style={{ borderColor: tag.color, color: tag.color }}>
                      {Ic
                        ? <Ic size={11} strokeWidth={2} />
                        : <span className={styles.tagDot} style={{ background: tag.color }} />}
                      <span className={styles.tagName}>{tag.name}</span>
                    </span>
                    <div className={styles.tagActions}>
                      <button className={styles.tagBtn} onClick={() => startEdit(tag)} title="Изменить">✎</button>
                      <button className={styles.tagBtnDanger} onClick={() => { onDelete(tag.id); if (editingId === tag.id) resetForm(); }} title="Удалить">✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Форма */}
          <div className={styles.form}>
            <div className={styles.formLabel}>{editingId ? 'Изменить тег' : 'Новый тег'}</div>

            <input
              ref={nameRef}
              className={styles.nameInput}
              placeholder="Название тега"
              value={name}
              maxLength={32}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') editingId ? handleUpdate() : handleCreate(); }}
            />

            <div className={styles.iconRow}>
              <IconPicker value={icon} onChange={setIcon} />
            </div>

            {/* Цветовой пикер */}
            <div className={styles.colorRow}>
              <label className={styles.colorLabel}>Цвет</label>
              <div className={styles.colorControls}>
                <div className={styles.colorSwatchWrap} title="Открыть палитру">
                  <input
                    type="color"
                    className={styles.colorInput}
                    value={color}
                    onChange={e => syncColor(e.target.value)}
                  />
                  <span className={styles.colorSwatch} style={{ background: color }} />
                </div>
                <input
                  type="text"
                  className={styles.hexInput}
                  value={hexInput}
                  maxLength={7}
                  placeholder="#4F46E5"
                  onChange={e => handleHexInput(e.target.value)}
                  onBlur={() => setHexInput(color)}
                />
              </div>
            </div>

            <div className={styles.formActions}>
              {editingId ? (
                <>
                  <button className={styles.cancelBtn} onClick={resetForm}>Отмена</button>
                  <button className={styles.saveBtn} onClick={handleUpdate} disabled={!name.trim()}>Сохранить</button>
                </>
              ) : (
                <button className={styles.saveBtn} onClick={handleCreate} disabled={!name.trim()}>
                  + Добавить тег
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
