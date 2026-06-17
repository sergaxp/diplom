import {
  Injectable,
  Inject,
  forwardRef,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ObjectLiteral } from 'typeorm';
import {
  TaskCollaborator,
  CollabStatus,
} from './entities/task-collaborator.entity';
import { ProjectCollaborator } from './entities/project-collaborator.entity';
import { CollabComment } from './entities/collab-comment.entity';
import { Task } from '../tasks/entities/task.entity';
import { Project } from '../projects/entities/project.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../push/push.service';
import { UsersService } from '../users/users.service';
import { CollabGateway } from './collab.gateway';

export type CollabEntity = 'task' | 'project';

export interface MiniProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  selectedFrame: string | null;
}

export interface CollabMemberDto extends MiniProfile {
  status: CollabStatus;
  isOwner: boolean;
}

export interface MembersResult {
  ownerId: string;
  members: CollabMemberDto[];
}

export interface CollabCommentDto {
  id: string;
  text: string;
  createdAt: string;
  author: MiniProfile;
}

export interface UserSearchResult extends MiniProfile {
  /** Состояние относительно конкретной сущности (если переданы entityType/entityId). */
  state: 'none' | 'pending' | 'member';
}

/** Общая форма строки участника (task_collaborators / project_collaborators). */
interface CollabRow extends ObjectLiteral {
  id: string;
  userId: string;
  invitedById: string;
  status: CollabStatus;
  respondedAt: Date | null;
  taskId?: string;
  projectId?: string;
}

@Injectable()
export class CollabService {
  constructor(
    @InjectRepository(TaskCollaborator)
    private readonly taskCollabRepo: Repository<TaskCollaborator>,
    @InjectRepository(ProjectCollaborator)
    private readonly projectCollabRepo: Repository<ProjectCollaborator>,
    @InjectRepository(CollabComment)
    private readonly commentRepo: Repository<CollabComment>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
    private readonly users: UsersService,
    @Inject(forwardRef(() => CollabGateway))
    private readonly gateway: CollabGateway,
  ) {}

  // ── Загрузка сущностей ─────────────────────────────────────────
  private async loadTask(id: string): Promise<Task> {
    const t = await this.taskRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Задача не найдена');
    return t;
  }
  private async loadProject(id: string): Promise<Project> {
    const p = await this.projectRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Проект не найден');
    return p;
  }

  // ── Резолюция доступа ──────────────────────────────────────────
  /** id всех задач, доступных пользователю: свои + accepted-задачи + задачи проектов с доступом. */
  async accessibleTaskIds(userId: string): Promise<string[]> {
    const owned = await this.taskRepo
      .createQueryBuilder('t')
      .select('t.id', 'id')
      .where('t.userId = :userId', { userId })
      .getRawMany<{ id: string }>();

    const taskCollab = await this.taskCollabRepo
      .createQueryBuilder('c')
      .select('c.taskId', 'id')
      .where('c.userId = :userId AND c.status = :s', { userId, s: 'accepted' })
      .getRawMany<{ id: string }>();

    const projIds = await this.accessibleProjectIds(userId);
    let projTask: { id: string }[] = [];
    if (projIds.length) {
      projTask = await this.taskRepo
        .createQueryBuilder('t')
        .select('t.id', 'id')
        .where('t.projectId IN (:...projIds)', { projIds })
        .getRawMany<{ id: string }>();
    }

    return [
      ...new Set([...owned, ...taskCollab, ...projTask].map((r) => r.id)),
    ];
  }

  /** id всех проектов, доступных пользователю: свои + accepted-проекты. */
  async accessibleProjectIds(userId: string): Promise<string[]> {
    const owned = await this.projectRepo
      .createQueryBuilder('p')
      .select('p.id', 'id')
      .where('p.userId = :userId', { userId })
      .getRawMany<{ id: string }>();
    const collab = await this.projectCollabRepo
      .createQueryBuilder('c')
      .select('c.projectId', 'id')
      .where('c.userId = :userId AND c.status = :s', { userId, s: 'accepted' })
      .getRawMany<{ id: string }>();
    return [...new Set([...owned, ...collab].map((r) => r.id))];
  }

  /** Задача, если пользователь может её редактировать (владелец/участник/участник проекта), иначе Forbidden. */
  async canEditTask(userId: string, taskId: string): Promise<Task> {
    const task = await this.loadTask(taskId);
    if (task.userId === userId) return task;
    const direct = await this.taskCollabRepo.findOne({
      where: { taskId, userId, status: 'accepted' },
    });
    if (direct) return task;
    if (task.projectId) {
      const proj = await this.projectRepo.findOne({
        where: { id: task.projectId },
      });
      if (proj && proj.userId === userId) return task;
      const viaProject = await this.projectCollabRepo.findOne({
        where: { projectId: task.projectId, userId, status: 'accepted' },
      });
      if (viaProject) return task;
    }
    throw new ForbiddenException('Нет доступа к задаче');
  }

  /** Проект, если пользователь может его редактировать (владелец/участник), иначе Forbidden. */
  async canEditProject(userId: string, projectId: string): Promise<Project> {
    const project = await this.loadProject(projectId);
    if (project.userId === userId) return project;
    const collab = await this.projectCollabRepo.findOne({
      where: { projectId, userId, status: 'accepted' },
    });
    if (collab) return project;
    throw new ForbiddenException('Нет доступа к проекту');
  }

  // ── Подгрузка участников к задачам/проектам (для списков) ───────
  async attachTaskCollaborators(tasks: Task[]): Promise<void> {
    if (!tasks.length) return;
    const ids = tasks.map((t) => t.id);
    const rows = await this.taskCollabRepo.find({
      where: { taskId: In(ids), status: 'accepted' },
    });
    await this.decorate(
      tasks,
      (t) => t.id,
      rows,
      (r) => r.taskId,
    );
  }

  async attachProjectCollaborators(projects: Project[]): Promise<void> {
    if (!projects.length) return;
    const ids = projects.map((p) => p.id);
    const rows = await this.projectCollabRepo.find({
      where: { projectId: In(ids), status: 'accepted' },
    });
    await this.decorate(
      projects,
      (p) => p.id,
      rows,
      (r) => r.projectId,
    );
  }

  private async decorate<
    E extends { userId: string },
    R extends { userId: string },
  >(
    entities: E[],
    entityKey: (e: E) => string,
    rows: R[],
    rowKey: (r: R) => string,
  ): Promise<void> {
    const byEntity = new Map<string, R[]>();
    for (const r of rows) {
      const k = rowKey(r);
      (byEntity.get(k) ?? byEntity.set(k, []).get(k)!).push(r);
    }
    const profileMap = await this.profileMap(rows.map((r) => r.userId));
    for (const e of entities) {
      const list = byEntity.get(entityKey(e)) ?? [];
      const collaborators: CollabMemberDto[] = list
        .map((r) => {
          const p = profileMap.get(r.userId);
          return p
            ? { ...p, status: 'accepted' as CollabStatus, isOwner: false }
            : null;
        })
        .filter((x): x is CollabMemberDto => x !== null);
      (e as unknown as { ownerId: string }).ownerId = e.userId;
      (e as unknown as { collaborators: CollabMemberDto[] }).collaborators =
        collaborators;
    }
  }

  private async profileMap(ids: string[]): Promise<Map<string, MiniProfile>> {
    const unique = [...new Set(ids)];
    const profiles = await this.users.getMiniProfiles(unique);
    return new Map(profiles.map((p) => [p.id, p]));
  }

  // ── Поиск пользователей для @упоминаний ────────────────────────
  async searchUsers(
    me: string,
    q: string,
    entityType?: CollabEntity,
    entityId?: string,
  ): Promise<UserSearchResult[]> {
    const found = await this.users.searchByUsername(q, me);
    if (!found.length) return [];

    // Аннотируем состояние относительно сущности (member/pending/none).
    const stateByUser = new Map<string, 'pending' | 'member'>();
    if (entityType && entityId) {
      const rows =
        entityType === 'task'
          ? await this.taskCollabRepo.find({ where: { taskId: entityId } })
          : await this.projectCollabRepo.find({
              where: { projectId: entityId },
            });
      for (const r of rows) {
        if (r.status === 'accepted') stateByUser.set(r.userId, 'member');
        else if (r.status === 'pending') stateByUser.set(r.userId, 'pending');
      }
    }
    return found.map((u) => ({
      ...u,
      state: stateByUser.get(u.id) ?? 'none',
    }));
  }

  // ── Участники ──────────────────────────────────────────────────
  async getMembers(
    me: string,
    entityType: CollabEntity,
    entityId: string,
  ): Promise<MembersResult> {
    const entity =
      entityType === 'task'
        ? await this.canEditTask(me, entityId)
        : await this.canEditProject(me, entityId);

    const rows =
      entityType === 'task'
        ? await this.taskCollabRepo.find({ where: { taskId: entityId } })
        : await this.projectCollabRepo.find({ where: { projectId: entityId } });
    const relevant = rows.filter((r) => r.status !== 'declined');

    const profileMap = await this.profileMap([
      entity.userId,
      ...relevant.map((r) => r.userId),
    ]);

    const owner = profileMap.get(entity.userId);
    const members: CollabMemberDto[] = [];
    if (owner) members.push({ ...owner, status: 'accepted', isOwner: true });
    for (const r of relevant) {
      const p = profileMap.get(r.userId);
      if (p) members.push({ ...p, status: r.status, isOwner: false });
    }
    return { ownerId: entity.userId, members };
  }

  // ── Приглашение ────────────────────────────────────────────────
  async invite(
    ownerId: string,
    entityType: CollabEntity,
    entityId: string,
    username: string,
  ): Promise<CollabMemberDto> {
    const entity =
      entityType === 'task'
        ? await this.loadTask(entityId)
        : await this.loadProject(entityId);
    if (entity.userId !== ownerId) {
      throw new ForbiddenException(
        'Приглашать участников может только создатель',
      );
    }
    const invitee = await this.users.findByUsername(
      username.trim().replace(/^@/, ''),
    );
    if (!invitee) throw new NotFoundException('Пользователь не найден');
    if (invitee.id === ownerId) {
      throw new BadRequestException('Нельзя пригласить самого себя');
    }

    const repo = this.repoFor(entityType);
    const where = this.whereFor(entityType, entityId, invitee.id);
    let row = await repo.findOne({ where });

    if (row && row.status === 'accepted') {
      throw new BadRequestException('Пользователь уже участник');
    }
    if (row) {
      // declined/pending → (пере)приглашаем
      row.status = 'pending';
      row.respondedAt = null;
      row.invitedById = ownerId;
      await repo.save(row);
    } else {
      row = repo.create({
        ...this.idFieldFor(entityType, entityId),
        userId: invitee.id,
        invitedById: ownerId,
        status: 'pending',
      });
      await repo.save(row);
    }

    const inviter = await this.users.findById(ownerId);
    const entityName = this.nameOf(entityType, entity);
    const kindLabel = entityType === 'task' ? 'задачу' : 'проект';
    await this.notifications.create({
      userId: invitee.id,
      kind: 'collab_invite',
      title: `Приглашение в ${kindLabel} «${entityName}»`,
      body: `@${inviter.username} приглашает вас к совместной работе`,
      icon: 'UserPlus',
      color: '#3b82f6',
      data: { entityType, entityId, inviteId: row.id },
      actionState: 'pending',
    });
    await this.push
      .sendToUser(invitee.id, {
        title: `Приглашение в ${kindLabel}`,
        body: `@${inviter.username}: «${entityName}»`,
        url: '/',
        fromUserId: ownerId,
      })
      .catch(() => undefined);
    this.gateway.notifyUser(invitee.id);
    this.gateway.emitMembersChanged(entityType, entityId);

    const profile: MiniProfile = {
      id: invitee.id,
      username: invitee.username,
      displayName: invitee.displayName,
      avatarUrl: invitee.avatarUrl,
      selectedFrame: invitee.selectedFrame,
    };
    return { ...profile, status: 'pending', isOwner: false };
  }

  // ── Ответ на приглашение ───────────────────────────────────────
  async respond(
    userId: string,
    entityType: CollabEntity,
    entityId: string,
    accept: boolean,
  ): Promise<{ status: CollabStatus }> {
    const repo = this.repoFor(entityType);
    const where = this.whereFor(entityType, entityId, userId);
    const row = await repo.findOne({ where });
    if (!row) throw new NotFoundException('Приглашение не найдено');

    if (row.status === 'pending') {
      row.status = accept ? 'accepted' : 'declined';
      row.respondedAt = new Date();
      await repo.save(row);
      await this.notifications.resolveInviteAction(row.id, row.status);

      if (accept) {
        const entity =
          entityType === 'task'
            ? await this.loadTask(entityId)
            : await this.loadProject(entityId);
        const entityName = this.nameOf(entityType, entity);
        const user = await this.users.findById(userId);
        // Уведомляем всех участников (владельца + остальных), кроме присоединившегося.
        await this.notifyParticipants(
          entityType,
          entityId,
          entity.userId,
          userId,
          {
            kind: 'collab_accepted',
            title: `@${user.username} присоединил(ся/ась)`,
            body: `${entityType === 'task' ? 'Задача' : 'Проект'} «${entityName}»`,
            icon: 'UserCheck',
            color: '#22c55e',
          },
        );
      }
      this.gateway.emitMembersChanged(entityType, entityId);
      this.gateway.notifyUser(userId);
    }
    return { status: row.status };
  }

  // ── Удаление участника / выход ─────────────────────────────────
  async removeMember(
    me: string,
    entityType: CollabEntity,
    entityId: string,
    targetUserId: string,
  ): Promise<void> {
    const entity =
      entityType === 'task'
        ? await this.loadTask(entityId)
        : await this.loadProject(entityId);
    const isOwner = entity.userId === me;
    if (!isOwner && me !== targetUserId) {
      throw new ForbiddenException('Удалять участников может только создатель');
    }
    if (targetUserId === entity.userId) {
      throw new BadRequestException('Нельзя удалить создателя');
    }
    const repo = this.repoFor(entityType);
    await repo.delete(this.whereFor(entityType, entityId, targetUserId));
    this.gateway.emitMembersChanged(entityType, entityId);
    this.gateway.notifyUser(targetUserId);
  }

  // ── Комментарии ────────────────────────────────────────────────
  async listComments(
    me: string,
    entityType: CollabEntity,
    entityId: string,
  ): Promise<CollabCommentDto[]> {
    await this.assertAccess(me, entityType, entityId);
    const where =
      entityType === 'task' ? { taskId: entityId } : { projectId: entityId };
    const comments = await this.commentRepo.find({
      where,
      order: { createdAt: 'ASC' },
    });
    const profileMap = await this.profileMap(comments.map((c) => c.authorId));
    return comments.map((c) => this.toCommentDto(c, profileMap));
  }

  async addComment(
    me: string,
    entityType: CollabEntity,
    entityId: string,
    text: string,
  ): Promise<CollabCommentDto> {
    const entity = await this.assertAccess(me, entityType, entityId);
    const comment = this.commentRepo.create({
      ...(entityType === 'task'
        ? { taskId: entityId }
        : { projectId: entityId }),
      authorId: me,
      text: text.trim(),
    });
    const saved = await this.commentRepo.save(comment);
    const profileMap = await this.profileMap([me]);
    const dto = this.toCommentDto(saved, profileMap);

    // Уведомляем всех участников (владелец + accepted), КРОМЕ автора комментария.
    const author = profileMap.get(me);
    const entityName = this.nameOf(entityType, entity);
    await this.notifyParticipants(entityType, entityId, entity.userId, me, {
      kind: 'collab_comment',
      title: `Новый комментарий · «${entityName}»`,
      body: `@${author?.username ?? ''}: ${text.trim().slice(0, 120)}`,
      icon: 'MessageCircle',
      color: '#8b5cf6',
    });
    this.gateway.emitCommentChanged(entityType, entityId);
    return dto;
  }

  async removeComment(me: string, commentId: string): Promise<void> {
    const comment = await this.commentRepo.findOne({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Комментарий не найден');
    const entityType: CollabEntity = comment.taskId ? 'task' : 'project';
    const entityId = (comment.taskId ?? comment.projectId)!;
    const entity = await this.assertAccess(me, entityType, entityId);
    if (comment.authorId !== me && entity.userId !== me) {
      throw new ForbiddenException('Нельзя удалить чужой комментарий');
    }
    await this.commentRepo.delete({ id: commentId });
    this.gateway.emitCommentChanged(entityType, entityId);
  }

  // ── Внутренние утилиты ─────────────────────────────────────────
  private nameOf(entityType: CollabEntity, entity: Task | Project): string {
    return entityType === 'task'
      ? (entity as Task).title
      : (entity as Project).name;
  }

  private async assertAccess(
    me: string,
    entityType: CollabEntity,
    entityId: string,
  ): Promise<Task | Project> {
    return entityType === 'task'
      ? this.canEditTask(me, entityId)
      : this.canEditProject(me, entityId);
  }

  /** id всех accepted-участников + владельца сущности (для рассылки уведомлений). */
  private async recipientIds(
    entityType: CollabEntity,
    entityId: string,
    ownerId: string,
  ): Promise<string[]> {
    const rows: { userId: string }[] =
      entityType === 'task'
        ? await this.taskCollabRepo.find({
            where: { taskId: entityId, status: 'accepted' },
          })
        : await this.projectCollabRepo.find({
            where: { projectId: entityId, status: 'accepted' },
          });
    return [...new Set([ownerId, ...rows.map((r) => r.userId)])];
  }

  /**
   * Шлёт уведомление всем участникам (владелец + accepted), КРОМЕ actor.
   * In-app + web-push + live-обновление колокольчика.
   */
  private async notifyParticipants(
    entityType: CollabEntity,
    entityId: string,
    ownerId: string,
    excludeUserId: string,
    n: {
      kind: 'collab_accepted' | 'collab_comment';
      title: string;
      body: string;
      icon: string;
      color: string;
    },
  ): Promise<void> {
    const recipients = await this.recipientIds(entityType, entityId, ownerId);
    for (const uid of recipients) {
      if (uid === excludeUserId) continue;
      await this.notifications.create({
        userId: uid,
        kind: n.kind,
        title: n.title,
        body: n.body,
        icon: n.icon,
        color: n.color,
        data: { entityType, entityId },
      });
      await this.push
        .sendToUser(uid, {
          title: n.title,
          body: n.body,
          url: '/',
          fromUserId: excludeUserId,
        })
        .catch(() => undefined);
      this.gateway.notifyUser(uid);
    }
  }

  private repoFor(entityType: CollabEntity): Repository<CollabRow> {
    return (entityType === 'task'
      ? this.taskCollabRepo
      : this.projectCollabRepo) as unknown as Repository<CollabRow>;
  }

  private whereFor(entityType: CollabEntity, entityId: string, userId: string) {
    return entityType === 'task'
      ? { taskId: entityId, userId }
      : { projectId: entityId, userId };
  }

  private idFieldFor(entityType: CollabEntity, entityId: string) {
    return entityType === 'task'
      ? { taskId: entityId }
      : { projectId: entityId };
  }

  private toCommentDto(
    c: CollabComment,
    profileMap: Map<string, MiniProfile>,
  ): CollabCommentDto {
    const author = profileMap.get(c.authorId);
    return {
      id: c.id,
      text: c.text,
      createdAt: c.createdAt.toISOString(),
      author: author ?? {
        id: c.authorId,
        username: 'unknown',
        displayName: null,
        avatarUrl: null,
        selectedFrame: null,
      },
    };
  }

  // ── Делегаты для realtime из Tasks/Projects сервисов ──────────
  emitTaskChanged(taskId: string): void {
    this.gateway.emitEntityChanged('task', taskId);
  }
  emitProjectChanged(projectId: string): void {
    this.gateway.emitEntityChanged('project', projectId);
  }
}
