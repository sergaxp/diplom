import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // GET /tasks/events – глобальные события (для всех пользователей)
  @Get('events')
  getGlobalTasks() {
    return this.tasksService.findGlobalTasks();
  }

  // GET /tasks/completions – must be BEFORE :id routes
  @Get('completions')
  getCompletions(@Request() req: { user: { id: string } }) {
    return this.tasksService.getCompletionKeys(req.user.id);
  }

  @Get()
  findAll(@Request() req: { user: { id: string } }) {
    return this.tasksService.findAll(req.user.id);
  }

  @Post()
  async create(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateTaskDto,
  ) {
    const { task, newAchievements } = await this.tasksService.create(req.user.id, dto);
    return { ...task, newAchievements };
  }

  @Patch(':id')
  update(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.tasksService.remove(req.user.id, id);
  }

  @Post(':id/complete/:date')
  @HttpCode(HttpStatus.OK)
  toggleCompletion(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Param('date') date: string,
  ) {
    return this.tasksService.toggleCompletion(req.user.id, id, date);
  }
}
