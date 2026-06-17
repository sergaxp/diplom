'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Task, SubtaskItem } from '../../../lib/tasks';
import type { Tag } from '../../../lib/tags';
import {
  Project, projectsApi, CreateProjectInput, UpdateProjectInput, DeleteProjectMode,
} from '../../../lib/projects';
import { ProjectList } from './ProjectList';
import { ProjectDetail } from './ProjectDetail';
import { ProjectFormModal } from './ProjectFormModal';
import styles from './ProjectsView.module.scss';

interface Props {
  projects: Project[];
  tasks: Task[];
  userTags: Tag[];
  isAdmin: boolean;
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onCreateTask: (data: Omit<Task, 'id' | 'status'>) => Promise<Task>;
  onUpdateTask: (id: string, data: Omit<Task, 'id' | 'status'>, occDate?: string) => void;
  onDeleteTask: (id: string) => void;
  onSetTaskDone: (taskId: string, done: boolean) => void;
  onSetSubtaskDone: (taskId: string, itemId: string, done: boolean) => void;
  onSetAllSubtasksDone: (taskId: string, done: boolean) => void;
  onUpdateSubtask: (taskId: string, item: SubtaskItem) => void;
  onDeleteSubtask: (taskId: string, itemId: string) => void;
  onCreateTag?: (name: string, color: string, icon?: string | null) => Promise<Tag>;
}

export function ProjectsView(props: Props) {
  const { projects, tasks, userTags, isAdmin, selectedProjectId, onSelectProject } = props;
  const qc = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const createMut = useMutation({
    mutationFn: (data: CreateProjectInput) => projectsApi.create(data),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setFormOpen(false);
      onSelectProject(p.id); // после создания — открыть проект
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectInput }) => projectsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setFormOpen(false);
      setEditing(null);
    },
  });
  const deleteMut = useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: DeleteProjectMode }) => projectsApi.remove(id, mode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      onSelectProject(null);
    },
  });

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (p: Project) => { setEditing(p); setFormOpen(true); };

  const handleSave = (data: CreateProjectInput & UpdateProjectInput) => {
    if (editing) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
  };

  const selected = selectedProjectId ? projects.find(p => p.id === selectedProjectId) ?? null : null;

  return (
    <div className={styles.root}>
      {selected ? (
        <ProjectDetail
          project={selected}
          tasks={tasks}
          userTags={userTags}
          isAdmin={isAdmin}
          onBack={() => onSelectProject(null)}
          onEdit={() => openEdit(selected)}
          onUpdateProject={(data) => updateMut.mutate({ id: selected.id, data })}
          onDeleteProject={(mode) => deleteMut.mutate({ id: selected.id, mode })}
          onCreateTask={props.onCreateTask}
          onUpdateTask={props.onUpdateTask}
          onDeleteTask={props.onDeleteTask}
          onSetTaskDone={props.onSetTaskDone}
          onSetSubtaskDone={props.onSetSubtaskDone}
          onSetAllSubtasksDone={props.onSetAllSubtasksDone}
          onUpdateSubtask={props.onUpdateSubtask}
          onDeleteSubtask={props.onDeleteSubtask}
          onCreateTag={props.onCreateTag}
        />
      ) : (
        <ProjectList
          projects={projects}
          tasks={tasks}
          userTags={userTags}
          onSelect={onSelectProject}
          onCreate={openCreate}
          onEdit={openEdit}
          onArchiveToggle={(p) => updateMut.mutate({ id: p.id, data: { archived: !p.archived } })}
        />
      )}

      {formOpen && (
        <ProjectFormModal
          project={editing ?? undefined}
          userTags={userTags}
          onSave={handleSave}
          onClose={() => { setFormOpen(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
