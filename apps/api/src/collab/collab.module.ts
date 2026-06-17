import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { CollabService } from './collab.service';
import { CollabController } from './collab.controller';
import { CollabGateway } from './collab.gateway';
import { TaskCollaborator } from './entities/task-collaborator.entity';
import { ProjectCollaborator } from './entities/project-collaborator.entity';
import { CollabComment } from './entities/collab-comment.entity';
import { Task } from '../tasks/entities/task.entity';
import { Project } from '../projects/entities/project.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { PushModule } from '../push/push.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskCollaborator,
      ProjectCollaborator,
      CollabComment,
      Task,
      Project,
    ]),
    NotificationsModule,
    PushModule,
    UsersModule,
    // Реестр JwtModule для верификации токена в WebSocket-gateway.
    JwtModule.register({ secret: process.env.JWT_SECRET }),
  ],
  controllers: [CollabController],
  providers: [CollabService, CollabGateway],
  exports: [CollabService, CollabGateway],
})
export class CollabModule {}
