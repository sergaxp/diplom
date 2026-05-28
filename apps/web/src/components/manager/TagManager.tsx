'use client';

import { useRef, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { ChevronDown, Pencil, X, Plus } from 'lucide-react';
import { Tag } from '../../lib/tags';
import { IconPicker } from '../IconPicker';
import { Button, IconButton, Input } from '../../components/ui';
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
        <button
          className={styles.toggle}
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
        >
          <span>Теги</span>
          <ChevronDown
            size={14}
            strokeWidth={1.75}
            className={[styles.chevron, open ? styles.chevronOpen : ''].join(' ')}
          />
        </button>
      )}

      {open && (
        <div className={styles.panel}>
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
                      <IconButton
                        icon={<Pencil size={12} strokeWidth={1.75} />}
                        aria-label="Изменить тег"
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(tag)}
                      />
                      <IconButton
                        icon={<X size={12} strokeWidth={1.75} />}
                        aria-label="Удалить тег"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          onDelete(tag.id);
                          if (editingId === tag.id) resetForm();
                        }}
                        className={styles.tagBtnDanger}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className={styles.form}>
            <div className={styles.formLabel}>{editingId ? 'Изменить тег' : 'Новый тег'}</div>

            <Input
              ref={nameRef}
              placeholder="Название тега"
              value={name}
              maxLength={32}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (editingId) handleUpdate(); else handleCreate();
                }
              }}
            />

            <div className={styles.iconRow}>
              <IconPicker value={icon} onChange={setIcon} />
            </div>

            <div className={styles.colorRow}>
              <label className={styles.colorLabel}>Цвет</label>
              <div className={styles.colorControls}>
                <div className={styles.colorSwatchWrap} title="Открыть палитру">
                  <input
                    type="color"
                    className={styles.colorInput}
                    value={color}
                    onChange={e => syncColor(e.target.value)}
                    aria-label="Выбрать цвет"
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
                  aria-label="HEX цвета"
                />
              </div>
            </div>

            <div className={styles.formActions}>
              {editingId ? (
                <>
                  <Button variant="secondary" size="sm" onClick={resetForm}>Отмена</Button>
                  <Button variant="primary" size="sm" onClick={handleUpdate} disabled={!name.trim()}>
                    Сохранить
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus size={14} strokeWidth={2} />}
                  onClick={handleCreate}
                  disabled={!name.trim()}
                >
                  Добавить тег
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
