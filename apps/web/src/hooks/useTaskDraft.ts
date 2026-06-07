import { useMemo } from 'react';
import { Draft, loadDraft, saveDraft, clearDraft } from '../lib/taskDraft';

type DraftFields = Omit<Draft, 'savedAt'>;

/**
 * Черновик новой задачи (localStorage): загрузка начального значения (используется
 * для инициализации полей формы — поэтому возвращается отдельно от автосохранения,
 * которое запускается эффектом в компоненте на основе живых значений формы) + save/clear.
 */
export function useTaskDraft(initialDate: string, isEdit: boolean) {
  const draft = useMemo(() => (!isEdit ? loadDraft(initialDate) : null), [isEdit, initialDate]);

  const save = (fields: DraftFields) => saveDraft(initialDate, { ...fields, savedAt: Date.now() });
  const clear = () => clearDraft(initialDate);

  return { draft, save, clear };
}
