import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('bots/:botId/contacts')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  create(@Param('botId') botId: string, @Request() req: any, @Body() dto: CreateContactDto) {
    return this.contactService.create(botId, req.user.userId, dto);
  }

  @Get()
  findAll(
    @Param('botId') botId: string,
    @Request() req: any,
    @Query('search') search?: string,
  ) {
    return this.contactService.findAll(botId, req.user.userId, search);
  }

  @Get(':id')
  findOne(@Param('botId') botId: string, @Request() req: any, @Param('id') id: string) {
    return this.contactService.findOne(botId, req.user.userId, id);
  }

  @Put(':id')
  update(
    @Param('botId') botId: string,
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactService.update(botId, req.user.userId, id, dto);
  }

  @Delete(':id')
  remove(@Param('botId') botId: string, @Request() req: any, @Param('id') id: string) {
    return this.contactService.remove(botId, req.user.userId, id);
  }
}
