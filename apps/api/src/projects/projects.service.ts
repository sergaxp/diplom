import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Project } from './entities/project.entity';
import { ProjectBoardPlacement } from './entities/project-board-placement.entity';
import { Task } from '../tasks/entities/task.entity';
import { TasksService } from '../tasks/tasks.service';
import { ActivityService } from '../activity/activity.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { SetProjectPlacementDto } from './dto/set-project-placement.dto';
import { UpdateProjectColumnsDto } from './dto/update-project-columns.dto';
import {
  BoardColumn,
  DEFAULT_PROJECT_COLUMNS,
  MAX_PROJECT_COLUMNS,
} from './project.types';

/** Что делать с задачами проекта при его удалении. */
export type DeleteProjectMode = 'deleteAll' | 'keepCompleted';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(ProjectBoardPlacement)
    private readonly placementRepo: Repository<ProjectBoardPlacement>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private readonly tasksService: TasksService,
    private readonly activity: ActivityService,
  ) {}

  private columnsOf(project: Project): BoardColumn[] {
    return project.boardColumns?.length
      ? project.boardColumns
      : DEFAULT_PROJECT_COLUMNS;
  }

  private async owned(userId: string, id: string): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { id, userId } });
    if (!project) throw new NotFoundException('Проект не найден');
    return project;
  }

  findAll(userId: string): Promise<Project[]> {
    return this.projectRepo.find({
      where: { userId },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
  }

  async create(userId: string, dto: CreateProjectDto): Promise<Project> {
    const max = await this.projectRepo
      .createQueryBuilder('p')
      .select('MAX(p.position)', 'max')
      .where('p.userId = :userId', { userId })
      .getRawOne<{ max: number | null }>();
    const project = this.projectRepo.create({
      userId,
      name: dto.name,
      description: dto.description ?? null,
      tagId: dto.tagId ?? null,
      color: dto.color ?? null,
      icon: dto.icon ?? null,
      deadline: dto.deadline ?? null,
      milestones: dto.milestones ?? null,
      position: (max?.max ?? 0) + 1,
    });
    const saved = await this.projectRepo.save(project);
    await this.activity.log({
      userId,
      projectId: saved.id,
      type: 'project_created',
      summary: `Создан проект «${saved.name}»`,
    });
    return saved;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateProjectDto,
  ): Promise<Project> {
    const project = await this.owned(userId, id);
    if (dto.name !== undefined) project.name = dto.name;
    if (dto.description !== undefined)
      project.description = dto.description ?? null;
    if (dto.tagId !== undefined) project.tagId = dto.tagId ?? null;
    if (dto.color !== undefined) project.color = dto.color ?? null;
    if (dto.icon !== undefined) project.icon = dto.icon ?? null;
    if (dto.deadline !== undefined) project.deadline = dto.deadline ?? null;
    if (dto.archived !== undefined) project.archived = dto.archived;
    if (dto.position !== undefined) project.position = dto.position;
    if (dto.milestones !== undefined)
      project.milestones = dto.milestones ?? null;
    return this.projectRepo.save(project);
  }

  // ── Доска проекта ──────────────────────────────────────────────
  async getBoard(
    userId: string,
    id: string,
  ): Promise<{ columns: BoardColumn[]; placements: ProjectBoardPlacement[] }> {
    const project = await this.owned(userId, id);
    const placements = await this.placementRepo.find({
      where: { projectId: id },
    });
    return { columns: this.columnsOf(project), placements };
  }

  async setColumns(
    userId: string,
    id: string,
    dto: UpdateProjectColumnsDto,
  ): Promise<{ columns: BoardColumn[] }> {
    const project = await this.owned(userId, id);
    const cols = dto.columns;
    if (cols.length > MAX_PROJECT_COLUMNS) {
      throw new BadRequestException('Слишком много колонок');
    }
    for (const role of ['todo', 'doing', 'done'] as const) {
      if (cols.filter((c) => c.role === role).length !== 1) {
        throw new BadRequestException(`Колонка роли ${role} должна быть одна`);
      }
    }
    project.boardColumns = cols;
    await this.projectRepo.save(project);
    return { columns: cols };
  }

  async setPlacement(
    userId: string,
    id: string,
    dto: SetProjectPlacementDto,
  ): Promise<ProjectBoardPlacement> {
    const project = await this.owned(userId, id);
    const existing = await this.placementRepo.findOne({
      where: { projectId: id, cardKey: dto.cardKey },
    });
    // Перемещение между колонками логируем; перестановку внутри колонки — нет.
    const movedColumn = existing ? existing.columnId !== dto.columnId : true; // новый placement = выезд из «todo» в doing/custom
    if (movedColumn) {
      await this.logMove(userId, project, dto.cardKey, dto.columnId);
    }
    if (existing) {
      existing.columnId = dto.columnId;
      existing.position = dto.position;
      return this.placementRepo.save(existing);
    }
    const created = this.placementRepo.create({
      projectId: id,
      cardKey: dto.cardKey,
      columnId: dto.columnId,
      position: dto.position,
    });
    return this.placementRepo.save(created);
  }

  /** Записать перемещение карточки задачи между колонками доски проекта. */
  private async logMove(
    userId: string,
    project: Project,
    cardKey: string,
    columnId: string,
  ): Promise<void> {
    if (!cardKey.startsWith('task:')) return; // группы/прочее не логируем
    const taskId = cardKey.slice('task:'.length);
    const [task, column] = [
      await this.taskRepo.findOne({ where: { id: taskId, userId } }),
      this.columnsOf(project).find((c) => c.id === columnId),
    ];
    if (!task) return;
    const colTitle = column?.name ?? 'другую колонку';
    await this.activity.log({
      userId,
      projectId: project.id,
      taskId,
      type: 'task_moved',
      summary: `Задача «${task.title}» → «${colTitle}»`,
      meta: { columnId, columnTitle: colTitle },
    });
  }

  /** Активность проекта за период: клетки heatmap + лента событий. */
  async getActivity(
    userId: string,
    id: string,
    from: Date,
    to: Date,
  ): Promise<Awaited<ReturnType<ActivityService['projectActivity']>>> {
    await this.owned(userId, id);
    return this.activity.projectActivity(userId, id, from, to);
  }

  async removePlacement(
    userId: string,
    id: string,
    cardKey: string,
  ): Promise<void> {
    await this.owned(userId, id);
    await this.placementRepo.delete({ projectId: id, cardKey });
  }

  // ── Удаление проекта ──────────────────────────────────────────
  async remove(
    userId: string,
    id: string,
    mode: DeleteProjectMode,
  ): Promise<void> {
    const project = await this.owned(userId, id);
    const tasks = await this.taskRepo.find({
      where: { userId, projectId: id },
    });

    if (mode === 'keepCompleted') {
      // «Завершённые» = задача с проставленным completedAt: отвязываем (оставляем
      // пользователю), остальные (начатые/не начатые) — удаляем.
      const toDetach = tasks.filter((t) => t.completedAt != null);
      const toDelete = tasks.filter((t) => t.completedAt == null);
      if (toDetach.length) {
        await this.taskRepo.update(
          { id: In(toDetach.map((t) => t.id)) },
          { projectId: null, milestoneId: null },
        );
      }
      for (const t of toDelete) await this.tasksService.remove(userId, t.id);
    } else {
      // deleteAll
      for (const t of tasks) await this.tasksService.remove(userId, t.id);
    }

    await this.placementRepo.delete({ projectId: id });
    await this.projectRepo.remove(project);
  }
}
