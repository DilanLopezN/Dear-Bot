import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BotService } from '../bot/bot.service';
import { CreateMenuDto, UpdateMenuDto } from './dto/menu.dto';
import { CaptureVariableConfig } from '../keyword/keyword.service';

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
  private readonly logger = new Logger(MenuService.name);

  constructor(
    private prisma: PrismaService,
    private botService: BotService,
  ) {}

  async create(userId: string, botId: string, dto: CreateMenuDto) {
    this.logger.log(`Criando menu "${dto.title}" (trigger: ${dto.trigger}) no bot ${botId}`);
    try {
      await this.botService.findOne(userId, botId);
      return await this.prisma.interactiveMenu.create({
        data: {
          botId,
          trigger: dto.trigger,
          title: dto.title,
          body: dto.body,
          footer: dto.footer,
          options: dto.options as any,
          captureVariable: dto.captureVariable ? (dto.captureVariable as any) : undefined,
        },
      });
    } catch (err) {
      this.logger.error(`Erro ao criar menu no bot ${botId}`, err);
      throw err;
    }
  }

  async findAll(userId: string, botId: string) {
    await this.botService.findOne(userId, botId);
    return this.prisma.interactiveMenu.findMany({
      where: { botId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(userId: string, botId: string, menuId: string, dto: UpdateMenuDto) {
    this.logger.log(`Atualizando menu ${menuId} no bot ${botId}`);
    try {
      await this.botService.findOne(userId, botId);
      const menu = await this.prisma.interactiveMenu.findFirst({ where: { id: menuId, botId } });
      if (!menu) throw new NotFoundException('Menu não encontrado');

      const { captureVariable, ...rest } = dto;
      return await this.prisma.interactiveMenu.update({
        where: { id: menuId },
        data: {
          ...rest,
          options: dto.options ? (dto.options as any) : undefined,
          captureVariable: captureVariable === null ? null : captureVariable ? (captureVariable as any) : undefined,
        },
      });
    } catch (err) {
      this.logger.error(`Erro ao atualizar menu ${menuId}`, err);
      throw err;
    }
  }

  async remove(userId: string, botId: string, menuId: string) {
    this.logger.log(`Removendo menu ${menuId} do bot ${botId}`);
    try {
      await this.botService.findOne(userId, botId);
      return await this.prisma.interactiveMenu.delete({ where: { id: menuId } });
    } catch (err) {
      this.logger.error(`Erro ao remover menu ${menuId}`, err);
      throw err;
    }
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

  async findMenuMatch(botId: string, message: string): Promise<{ menu: any; options: MenuOption[]; captureVariable?: CaptureVariableConfig } | null> {
    const menus = await this.prisma.interactiveMenu.findMany({
      where: { botId, isActive: true },
    });

    const normalized = message.toLowerCase().trim();
    for (const menu of menus) {
      if (normalized.includes(menu.trigger.toLowerCase())) {
        return {
          menu,
          options: menu.options as unknown as MenuOption[],
          captureVariable: menu.captureVariable as unknown as CaptureVariableConfig | undefined,
        };
      }
    }
    return null;
  }

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
