import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BotService } from '../bot/bot.service';
import { CreateMenuDto, UpdateMenuDto } from './dto/menu.dto';

export interface MenuOption {
  id: string;
  title: string;
  description?: string;
  goto?: {
    type: 'MENU' | 'KEYWORD';
    target: string;
  };
}

@Injectable()
export class MenuService {
  constructor(
    private prisma: PrismaService,
    private botService: BotService,
  ) {}

  async create(userId: string, botId: string, dto: CreateMenuDto) {
    await this.botService.findOne(userId, botId);
    return this.prisma.interactiveMenu.create({
      data: {
        botId,
        trigger: dto.trigger,
        title: dto.title,
        body: dto.body,
        footer: dto.footer,
        options: dto.options as any,
      },
    });
  }

  async findAll(userId: string, botId: string) {
    await this.botService.findOne(userId, botId);
    return this.prisma.interactiveMenu.findMany({
      where: { botId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(userId: string, botId: string, menuId: string, dto: UpdateMenuDto) {
    await this.botService.findOne(userId, botId);
    const menu = await this.prisma.interactiveMenu.findFirst({ where: { id: menuId, botId } });
    if (!menu) throw new NotFoundException('Menu não encontrado');
    return this.prisma.interactiveMenu.update({
      where: { id: menuId },
      data: {
        ...dto,
        options: dto.options ? (dto.options as any) : undefined,
      },
    });
  }

  async remove(userId: string, botId: string, menuId: string) {
    await this.botService.findOne(userId, botId);
    return this.prisma.interactiveMenu.delete({ where: { id: menuId } });
  }

  async findByTrigger(botId: string, trigger: string) {
    return this.prisma.interactiveMenu.findFirst({
      where: {
        botId,
        isActive: true,
        trigger: { equals: trigger, mode: 'insensitive' },
      },
    });
  }

  /** Finds a menu matching the user message (case-insensitive) */
  async findMenuMatch(botId: string, message: string): Promise<{ menu: any; options: MenuOption[] } | null> {
    const menus = await this.prisma.interactiveMenu.findMany({
      where: { botId, isActive: true },
    });

    const normalized = message.toLowerCase().trim();
    for (const menu of menus) {
      if (normalized.includes(menu.trigger.toLowerCase())) {
        return { menu, options: menu.options as unknown as MenuOption[] };
      }
    }
    return null;
  }

  /** Finds a menu option response by option ID */
  async findOptionResponse(botId: string, optionId: string): Promise<{ menu: any; option: MenuOption } | null> {
    const menus = await this.prisma.interactiveMenu.findMany({
      where: { botId, isActive: true },
    });

    for (const menu of menus) {
      const options = menu.options as unknown as MenuOption[];
      const option = options.find((o) => o.id.toLowerCase() === optionId.toLowerCase());
      if (option) {
        return { menu, option };
      }
    }
    return null;
  }
}
