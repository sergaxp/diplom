import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoardPlacement } from './entities/board-placement.entity';
import { User } from '../users/entities/user.entity';
import { BoardService } from './board.service';
import { BoardController } from './board.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BoardPlacement, User])],
  controllers: [BoardController],
  providers: [BoardService],
  exports: [BoardService],
})
export class BoardModule {}
