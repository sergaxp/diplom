import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { ProjectBoardPlacement } from './entities/project-board-placement.entity';
import { Task } from '../tasks/entities/task.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { TasksModule } from '../tasks/tasks.module';
import { ActivityModule } from '../activity/activity.module';
import { CollabModule } from '../collab/collab.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, ProjectBoardPlacement, Task]),
    TasksModule,
    ActivityModule,
    CollabModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
