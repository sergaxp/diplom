'use client';

import { CalendarDays, Columns3, LayoutGrid, Inbox } from 'lucide-react';
import styles from './WorkspaceSwitcher.module.scss';

export type Workspace = 'manager' | 'board' | 'projects' | 'box';

interface ItemDef {
  id: Workspace;
  label: string;
  icon: typeof CalendarDays;
  soon?: boolean;
}

const ITEMS: ItemDef[] = [
  { id: 'manager',  label: 'Менеджер', icon: CalendarDays },
  { id: 'board',    label: 'Доска',    icon: Columns3 },
  { id: 'projects', label: 'Проекты',  icon: LayoutGrid },
  { id: 'box',      label: 'Коробка',  icon: Inbox },
];

/** Человекочитаемое название рабочей области (для заголовка вкладки и пр.). */
export const WORKSPACE_LABELS: Record<Workspace, string> = {
  manager:  'Менеджер',
  board:    'Доска',
  projects: 'Проекты',
  box:      'Коробка',
};

interface Props {
  active: Workspace;
  onChange: (w: Workspace) => void;
  /** Кол-во просрочённых задач — бейдж на «Коробке». */
  boxBadge?: number;
}

export function WorkspaceSwitcher({ active, onChange, boxBadge = 0 }: Props) {
  return (
    <nav className={styles.root} aria-label="Рабочие области">
      {ITEMS.map(({ id, label, icon: Icon, soon }) => (
        <button
          key={id}
          type="button"
          className={[styles.item, active === id ? styles.itemActive : ''].join(' ')}
          onClick={() => onChange(id)}
          aria-current={active === id ? 'page' : undefined}
        >
          <Icon size={19} strokeWidth={1.75} className={styles.icon} />
          <span className={styles.label}>{label}</span>
          {soon && <span className={styles.soon}>скоро</span>}
          {id === 'box' && boxBadge > 0 && (
            <span className={styles.badge} title={`Просрочено: ${boxBadge}`}>
              {boxBadge > 99 ? '99+' : boxBadge}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
