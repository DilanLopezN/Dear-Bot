import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateContactDto } from "./dto/create-contact.dto";
import { UpdateContactDto } from "./dto/update-contact.dto";

@Injectable()
export class ContactService {
  constructor(private prisma: PrismaService) {}

  private async ensureBotOwnership(botId: string, userId: string) {
    const bot = await this.prisma.bot.findFirst({
      where: { id: botId, userId },
    });
    if (!bot) throw new NotFoundException("Bot não encontrado");
    return bot;
  }

  async create(botId: string, userId: string, dto: CreateContactDto) {
    await this.ensureBotOwnership(botId, userId);
    const existing = await this.prisma.contact.findUnique({
      where: { botId_phone: { botId, phone: dto.phone } },
    });
    if (existing)
      throw new ConflictException(
        "Contato com esse número já existe para este bot",
      );
    return this.prisma.contact.create({
      data: { botId, ...(dto as any) },
    });
  }

  async findAll(botId: string, userId: string, search?: string) {
    await this.ensureBotOwnership(botId, userId);
    const where: any = { botId };
    if (search) {
      where.OR = [
        { phone: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    return this.prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(botId: string, userId: string, id: string) {
    await this.ensureBotOwnership(botId, userId);
    const contact = await this.prisma.contact.findFirst({
      where: { id, botId },
    });
    if (!contact) throw new NotFoundException("Contato não encontrado");
    return contact;
  }

  async update(
    botId: string,
    userId: string,
    id: string,
    dto: UpdateContactDto,
  ) {
    await this.findOne(botId, userId, id);
    if (dto.phone) {
      const conflict = await this.prisma.contact.findFirst({
        where: { botId, phone: dto.phone, NOT: { id } },
      });
      if (conflict)
        throw new ConflictException("Número já pertence a outro contato");
    }
    return this.prisma.contact.update({ where: { id }, data: dto as any });
  }

  async remove(botId: string, userId: string, id: string) {
    await this.findOne(botId, userId, id);
    await this.prisma.contact.delete({ where: { id } });
    return { message: "Contato removido com sucesso" };
  }

  /** Salva ou atualiza contato automaticamente ao receber mensagem */
  async upsertFromConversation(botId: string, phone: string, name?: string) {
    return this.prisma.contact.upsert({
      where: { botId_phone: { botId, phone } },
      create: { botId, phone, name },
      update: name ? { name } : {},
    });
  }
}
