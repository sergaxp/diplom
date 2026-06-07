'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ICON_CATEGORIES, Icon, hasIcon } from '../lib/icons';
import styles from './IconPicker.module.scss';

const ALL_CATEGORY = 'Все';
const ALL_ICON_NAMES = [...new Set(ICON_CATEGORIES.flatMap(c => c.names))];

interface Props {
  value: string;
  onChange: (name: string) => void;
}

export function IconPicker({ value, onChange }: Props) {
  const [open,     setOpen]     = useState(false);
  const [category, setCategory] = useState(ALL_CATEGORY);
  const [search,   setSearch]   = useState('');
  const [dropPos,  setDropPos]  = useState({ top: 0, left: 0 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const catsRef    = useRef<HTMLDivElement>(null);
  const searchRef  = useRef<HTMLInputElement>(null);
  const dropRef    = useRef<HTMLDivElement>(null);

  // Закрытие по клику вне
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !dropRef.current?.contains(t)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // Фокус на поиске при открытии
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  const handleToggle = () => {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const vw = typeof window !== 'undefined' ? window.innerWidth  : 1024;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
      // На мобильных дропдаун шире кнопки –  зажимаем его в видимую область
      const dropW = Math.min(312, vw - 16);
      const dropH = 380; // высота с категориями + поиск + сетка
      const left  = Math.min(Math.max(8, r.left), vw - dropW - 8);
      const top   = r.bottom + 5 + dropH > vh
        ? Math.max(8, r.top - dropH - 5)
        : r.bottom + 5;
      setDropPos({ top, left });
    }
    setOpen(v => !v);
  };

  const handleCatsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!catsRef.current) return;
    e.preventDefault();
    catsRef.current.scrollLeft += e.deltaY;
  };

  const q = search.toLowerCase().trim();
  const visibleNames: readonly string[] = q
    ? ALL_ICON_NAMES.filter(n => n.toLowerCase().includes(q))
    : category === ALL_CATEGORY
      ? ALL_ICON_NAMES
      : ICON_CATEGORIES.find(c => c.label === category)?.names ?? [];


  const dropdown = (
    <div
      ref={dropRef}
      className={styles.dropdown}
      style={{ top: dropPos.top, left: dropPos.left }}
    >
      {/* Категории */}
      <div ref={catsRef} className={styles.cats} onWheel={handleCatsWheel}>
        {[ALL_CATEGORY, ...ICON_CATEGORIES.map(c => c.label)].map(cat => (
          <button key={cat} type="button"
            className={[styles.cat, !q && category === cat ? styles.catActive : ''].join(' ')}
            onClick={() => { setCategory(cat); setSearch(''); }}>
            {cat}
          </button>
        ))}
      </div>

      {/* Поиск */}
      <div className={styles.searchWrap}>
        <input
          ref={searchRef}
          className={styles.search}
          placeholder="Поиск иконки..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button type="button" className={styles.searchClear}
            onClick={() => { setSearch(''); searchRef.current?.focus(); }}>
            ✕
          </button>
        )}
      </div>

      {/* Сетка */}
      <div className={styles.grid}>
        {!q && (
          <button type="button" title="Без иконки"
            className={[styles.btn, styles.btnNone, !value ? styles.btnActive : ''].join(' ')}
            onClick={() => { onChange(''); setOpen(false); setSearch(''); }}>
            –
          </button>
        )}
        {visibleNames.length === 0 && q && (
          <div className={styles.empty}>Ничего не найдено</div>
        )}
        {visibleNames.map(name => (
          hasIcon(name) && (
            <button key={name} type="button" title={name}
              className={[styles.btn, value === name ? styles.btnActive : ''].join(' ')}
              onClick={() => { onChange(name); setOpen(false); setSearch(''); }}>
              <Icon name={name} size={18} strokeWidth={1.75} />
            </button>
          )
        ))}
      </div>
    </div>
  );

  return (
    <div className={styles.wrap}>
      <button ref={triggerRef} type="button" className={styles.trigger}
        onClick={handleToggle} title={value || 'Без иконки'}>
        {hasIcon(value)
          ? <Icon name={value} size={16} strokeWidth={1.75} />
          : <span className={styles.fallback}>–</span>}
        <span className={[styles.name, !value ? styles.nameEmpty : ''].join(' ')}>
          {value || 'Без иконки'}
        </span>
        <svg className={[styles.chevron, open ? styles.chevronOpen : ''].join(' ')}
          width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  );
}
