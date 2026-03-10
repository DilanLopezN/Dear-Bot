import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { MenuService } from './menu.service';
import { CreateMenuDto, UpdateMenuDto } from './dto/menu.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('bots/:botId/menus')
@UseGuards(JwtAuthGuard)
export class MenuController {
  constructor(private menuService: MenuService) {}

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Param('botId') botId: string,
    @Body() dto: CreateMenuDto,
  ) {
    return this.menuService.create(userId, botId, dto);
  }

  @Get()
  findAll(@CurrentUser('id') userId: string, @Param('botId') botId: string) {
    return this.menuService.findAll(userId, botId);
  }

  @Put(':menuId')
  update(
    @CurrentUser('id') userId: string,
    @Param('botId') botId: string,
    @Param('menuId') menuId: string,
    @Body() dto: UpdateMenuDto,
  ) {
    return this.menuService.update(userId, botId, menuId, dto);
  }

  @Delete(':menuId')
  remove(
    @CurrentUser('id') userId: string,
    @Param('botId') botId: string,
    @Param('menuId') menuId: string,
  ) {
    return this.menuService.remove(userId, botId, menuId);
  }
}
