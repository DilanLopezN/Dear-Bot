import { Controller, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { WhatsappChannelService } from './whatsapp-channel.service';
import { CreateWhatsappChannelDto, UpdateWhatsappChannelDto } from './dto/whatsapp-channel.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('bots/:botId/whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsappChannelController {
  constructor(private service: WhatsappChannelService) {}

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Param('botId') botId: string,
    @Body() dto: CreateWhatsappChannelDto,
  ) {
    return this.service.create(userId, botId, dto);
  }

  @Put()
  update(
    @CurrentUser('id') userId: string,
    @Param('botId') botId: string,
    @Body() dto: UpdateWhatsappChannelDto,
  ) {
    return this.service.update(userId, botId, dto);
  }

  @Delete()
  remove(@CurrentUser('id') userId: string, @Param('botId') botId: string) {
    return this.service.remove(userId, botId);
  }
}
