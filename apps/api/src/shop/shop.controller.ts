import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ShopService } from './shop.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';

@ApiTags('shop')
@ApiBearerAuth()
@Controller('shop')
@UseGuards(JwtAuthGuard)
export class ShopController {
  constructor(private readonly shop: ShopService) {}

  @Get('items')
  getItems(@Request() req: AuthenticatedRequest) {
    return this.shop.getItems(req.user.id);
  }

  @Post('buy/:itemId')
  buy(@Request() req: AuthenticatedRequest, @Param('itemId') itemId: string) {
    return this.shop.buy(req.user.id, itemId);
  }
}
