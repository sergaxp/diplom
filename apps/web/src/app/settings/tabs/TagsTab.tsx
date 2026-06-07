'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { User } from '../../../lib/auth';
import { tagsApi } from '../../../lib/tags';
import { TagManager } from '../../../components/manager/TagManager';
import { SectionHeader } from '../SectionHeader';
import styles from '../page.module.scss';

export function TagsTab({ user, qc }: { user: User; qc: ReturnType<typeof useQueryClient> }) {
  const { data: userTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: tagsApi.getAll,
    enabled: !!user,
    staleTime: 60_000,
  });

  const createTagMut = useMutation({
    mutationFn: tagsApi.create,
    onSettled: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
  const deleteTagMut = useMutation({
    mutationFn: tagsApi.remove,
    onSettled: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
  const updateTagMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof tagsApi.update>[1] }) =>
      tagsApi.update(id, data),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });

  return (
    <>
      <SectionHeader
        title="Теги"
        subtitle="Теги помогают группировать задачи. Иконка тега отображается в календаре вместо точки."
      />
      <div className={styles.section}>
        <TagManager
          tags={userTags}
          alwaysOpen
          onCreate={d => createTagMut.mutate(d)}
          onDelete={id => deleteTagMut.mutate(id)}
          onUpdate={(id, d) => updateTagMut.mutate({ id, data: d })}
        />
      </div>
    </>
  );
}
