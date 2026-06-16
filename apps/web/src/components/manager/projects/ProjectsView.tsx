'use client';

import { FolderKanban } from 'lucide-react';
import { EmptyState } from '../../ui';
import styles from '../board/placeholder.module.scss';

/**
 * Заглушка рабочей области «Проекты». Подготовка под будущую сущность Project:
 * группировка задач в проекты с прогрессом/дедлайнами.
 *
 * Планируемая модель (бэкенд, отдельный этап):
 *   Project { id, userId, name, color, icon, archived, createdAt }
 *   Task.projectId?: string  — связь задачи с проектом (nullable)
 *
 * Фронтенд тогда: projectsApi.getAll(), боковой список проектов + лента задач
 * выбранного проекта (переиспользуя строки из «Коробки»).
 */
export function ProjectsView() {
  return (
    <div className={styles.root}>
      <EmptyState
        size="lg"
        icon={<FolderKanban size={48} strokeWidth={1.25} />}
        title="Проекты скоро появятся"
        description="Здесь можно будет объединять задачи в проекты, видеть прогресс и дедлайны по каждому."
      />
    </div>
  );
}
