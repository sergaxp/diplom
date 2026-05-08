import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { TaskCompletion } from './entities/task-completion.entity';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Task, TaskCompletion])],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
