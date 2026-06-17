import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectsService, DeleteProjectMode } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { SetProjectPlacementDto } from './dto/set-project-placement.dto';
import { UpdateProjectColumnsDto } from './dto/update-project-columns.dto';
import { activityRange } from '../activity/activity.types';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(@Request() req: { user: { id: string } }) {
    return this.projectsService.findAll(req.user.id);
  }

  @Post()
  create(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(req.user.id, dto);
  }

  @Patch(':id')
  update(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Query('mode') mode?: string,
  ) {
    const m: DeleteProjectMode =
      mode === 'keepCompleted' ? 'keepCompleted' : 'deleteAll';
    return this.projectsService.remove(req.user.id, id, m);
  }

  // ── Доска проекта ──────────────────────────────────────────────
  @Get(':id/board')
  getBoard(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.projectsService.getBoard(req.user.id, id);
  }

  @Put(':id/columns')
  setColumns(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateProjectColumnsDto,
  ) {
    return this.projectsService.setColumns(req.user.id, id, dto);
  }

  @Put(':id/placement')
  setPlacement(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: SetProjectPlacementDto,
  ) {
    return this.projectsService.setPlacement(req.user.id, id, dto);
  }

  @Delete(':id/placement')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePlacement(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Query('cardKey') cardKey: string,
  ) {
    return this.projectsService.removePlacement(req.user.id, id, cardKey);
  }

  // ── Активность проекта (heatmap + лента) ──────────────────────
  @Get(':id/activity')
  getActivity(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const { fromDate, toDate } = activityRange(from, to);
    return this.projectsService.getActivity(req.user.id, id, fromDate, toDate);
  }
}
