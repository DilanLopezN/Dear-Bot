import { Controller, Get, Post, Delete, Param, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FastifyRequest } from 'fastify';

@Controller('bots/:botId/knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(private knowledgeService: KnowledgeService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string, @Param('botId') botId: string) {
    return this.knowledgeService.findAll(userId, botId);
  }

  @Post('upload')
  async upload(
    @CurrentUser('id') userId: string,
    @Param('botId') botId: string,
    @Req() req: FastifyRequest,
  ) {
    const data = await (req as any).file();
    if (!data) {
      throw new BadRequestException('Nenhum arquivo enviado. Envie um arquivo PDF, TXT, CSV ou Excel.');
    }

    const buffer = await data.toBuffer();

    return this.knowledgeService.upload(userId, botId, {
      buffer,
      originalName: data.filename,
      size: buffer.length,
    });
  }

  @Delete(':knowledgeId')
  remove(
    @CurrentUser('id') userId: string,
    @Param('botId') botId: string,
    @Param('knowledgeId') knowledgeId: string,
  ) {
    return this.knowledgeService.remove(userId, botId, knowledgeId);
  }
}
