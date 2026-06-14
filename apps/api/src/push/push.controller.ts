import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { PushService } from './push.service';
import type { PushSubscriptionJSON } from './push.service';

@ApiTags('push')
@ApiBearerAuth()
@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly svc: PushService) {}

  @Get('public-key')
  publicKey() {
    return { key: this.svc.getPublicKey() };
  }

  @Post('subscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  async subscribe(
    @Request() req: AuthenticatedRequest,
    @Body() sub: PushSubscriptionJSON,
  ) {
    await this.svc.subscribe(req.user.id, sub);
  }

  @Post('unsubscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsubscribe(@Body() body: { endpoint: string }) {
    await this.svc.unsubscribe(body.endpoint);
  }
}
