import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { ShopService } from './shop.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('shop')
@UseGuards(JwtAuthGuard)
export class ShopController {
  constructor(private readonly shop: ShopService) {}

  @Get('items')
  getItems(@Request() req) {
    return this.shop.getItems(req.user.id);
  }

  @Post('buy/:itemId')
  buy(@Request() req, @Param('itemId') itemId: string) {
    return this.shop.buy(req.user.id, itemId);
  }
}
