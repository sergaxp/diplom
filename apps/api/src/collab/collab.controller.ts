import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { CollabService, CollabEntity } from './collab.service';
import {
  InviteDto,
  RespondDto,
  CreateCollabCommentDto,
} from './dto/collab.dto';

function parseEntity(t: string): CollabEntity {
  if (t !== 'task' && t !== 'project') {
    throw new BadRequestException('Неверный тип сущности');
  }
  return t;
}

@ApiTags('collab')
@ApiBearerAuth()
@Controller('collab')
@UseGuards(JwtAuthGuard)
export class CollabController {
  constructor(private readonly collab: CollabService) {}

  // GET /collab/search?q=&entityType=&entityId= — должен идти ДО :entityType/:entityId
  @Get('search')
  search(
    @Request() req: AuthenticatedRequest,
    @Query('q') q: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ) {
    const et = entityType ? parseEntity(entityType) : undefined;
    return this.collab.searchUsers(req.user.id, q ?? '', et, entityId);
  }

  @Get(':entityType/:entityId/members')
  members(
    @Request() req: AuthenticatedRequest,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.collab.getMembers(
      req.user.id,
      parseEntity(entityType),
      entityId,
    );
  }

  @Post(':entityType/:entityId/invite')
  invite(
    @Request() req: AuthenticatedRequest,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Body() dto: InviteDto,
  ) {
    return this.collab.invite(
      req.user.id,
      parseEntity(entityType),
      entityId,
      dto.username,
    );
  }

  @Post(':entityType/:entityId/respond')
  respond(
    @Request() req: AuthenticatedRequest,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Body() dto: RespondDto,
  ) {
    return this.collab.respond(
      req.user.id,
      parseEntity(entityType),
      entityId,
      dto.accept,
    );
  }

  @Delete(':entityType/:entityId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Request() req: AuthenticatedRequest,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Param('userId') userId: string,
  ) {
    return this.collab.removeMember(
      req.user.id,
      parseEntity(entityType),
      entityId,
      userId,
    );
  }

  @Get(':entityType/:entityId/comments')
  comments(
    @Request() req: AuthenticatedRequest,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.collab.listComments(
      req.user.id,
      parseEntity(entityType),
      entityId,
    );
  }

  @Post(':entityType/:entityId/comments')
  addComment(
    @Request() req: AuthenticatedRequest,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Body() dto: CreateCollabCommentDto,
  ) {
    return this.collab.addComment(
      req.user.id,
      parseEntity(entityType),
      entityId,
      dto.text,
    );
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeComment(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.collab.removeComment(req.user.id, id);
  }
}
