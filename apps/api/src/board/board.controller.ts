import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BoardService } from './board.service';
import { SetPlacementDto } from './dto/set-placement.dto';
import { UpdateColumnsDto } from './dto/update-columns.dto';

@ApiTags('board')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('board')
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Get()
  getState(@Request() req: { user: { id: string } }) {
    return this.boardService.getState(req.user.id);
  }

  @Put('columns')
  setColumns(
    @Request() req: { user: { id: string } },
    @Body() dto: UpdateColumnsDto,
  ) {
    return this.boardService.setColumns(req.user.id, dto);
  }

  @Put('placement')
  setPlacement(
    @Request() req: { user: { id: string } },
    @Body() dto: SetPlacementDto,
  ) {
    return this.boardService.setPlacement(req.user.id, dto);
  }

  @Delete('placement')
  removePlacement(
    @Request() req: { user: { id: string } },
    @Query('cardKey') cardKey: string,
    @Query('date') date: string,
  ) {
    return this.boardService.removePlacement(req.user.id, cardKey, date);
  }
}
