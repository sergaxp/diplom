'use client';

import { useState } from 'react';
import { Modal, Button, Input, Textarea } from '../../ui';
import { Icon, hasIcon } from '../../../lib/icons';
import { COLUMN_COLORS } from '../../../lib/board';
import type { Tag } from '../../../lib/tags';
import type { Project, CreateProjectInput, UpdateProjectInput } from '../../../lib/projects';
import styles from './ProjectFormModal.module.scss';

/** Небольшой набор иконок-эмодзи проекта (Lucide). */
const PROJECT_ICONS = [
  'FolderKanban', 'Rocket', 'Target', 'Briefcase', 'BookOpen', 'Code2',
  'Palette', 'Dumbbell', 'House', 'GraduationCap', 'Plane', 'Heart',
  'Lightbulb', 'Music', 'Camera', 'Leaf',
];

interface Props {
  /** Если задан — режим редактирования. */
  project?: Project;
  userTags: Tag[];
  onSave: (data: CreateProjectInput & UpdateProjectInput) => void;
  onClose: () => void;
}

export function ProjectFormModal({ project, userTags, onSave, onClose }: Props) {
  const isEdit = !!project;
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [tagId, setTagId] = useState<string | null>(project?.tagId ?? null);
  const [color, setColor] = useState<string | null>(project?.color ?? COLUMN_COLORS[4]);
  const [icon, setIcon] = useState<string | null>(project?.icon ?? 'FolderKanban');
  const [deadline, setDeadline] = useState(project?.deadline ?? '');

  const canSave = name.trim().length > 0;

  const submit = () => {
    if (!canSave) return;
    onSave({
      name: name.trim(),
      description: description.trim() || null,
      tagId,
      color,
      icon,
      deadline: deadline || null,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Редактировать проект' : 'Новый проект'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button variant="accent" onClick={submit} disabled={!canSave}>
            {isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <label className={styles.field}>
          <span className={styles.label}>Название</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, Дипломный проект"
            autoFocus
            maxLength={255}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Описание</span>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Коротко о проекте"
            rows={3}
          />
        </label>

        <div className={styles.field}>
          <span className={styles.label}>Тег</span>
          <div className={styles.tags}>
            <button
              type="button"
              className={[styles.tagChip, tagId === null ? styles.tagChipActive : ''].join(' ')}
              onClick={() => setTagId(null)}
            >
              Без тега
            </button>
            {userTags.map((t) => (
              <button
                key={t.id}
                type="button"
                className={[styles.tagChip, tagId === t.id ? styles.tagChipActive : ''].join(' ')}
                style={tagId === t.id ? { borderColor: t.color, background: `${t.color}22` } : { borderColor: t.color }}
                onClick={() => setTagId(t.id)}
              >
                {hasIcon(t.icon) && <Icon name={t.icon} size={12} strokeWidth={2} />}
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <span className={styles.label}>Цвет</span>
            <div className={styles.colors}>
              {COLUMN_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={[styles.swatch, color === c ? styles.swatchActive : ''].join(' ')}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={`Цвет ${c}`}
                />
              ))}
            </div>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Дедлайн</span>
            <input
              type="date"
              className={styles.dateInput}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Иконка</span>
          <div className={styles.icons}>
            {PROJECT_ICONS.map((name) => (
              <button
                key={name}
                type="button"
                className={[styles.iconBtn, icon === name ? styles.iconBtnActive : ''].join(' ')}
                style={icon === name && color ? { borderColor: color, color } : undefined}
                onClick={() => setIcon(name)}
                aria-label={name}
              >
                <Icon name={name} size={18} strokeWidth={1.75} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
