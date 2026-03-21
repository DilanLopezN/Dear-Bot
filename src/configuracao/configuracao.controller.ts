import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfiguracaoService } from './configuracao.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('configuracao')
@UseGuards(JwtAuthGuard)
export class ConfiguracaoController {
  constructor(private service: ConfiguracaoService) {}

  /** Retorna dados da instância Evolution e info do plano do usuário */
  @Get('instance')
  getInstance(@CurrentUser('id') userId: string) {
    return this.service.getInstance(userId);
  }

  /** Cria uma instância Evolution para o usuário autenticado */
  @Post('instance')
  createInstance(@CurrentUser('id') userId: string) {
    return this.service.createInstance(userId);
  }

  /** Retorna o QR Code para conectar o WhatsApp */
  @Get('instance/qrcode')
  getQrCode(@CurrentUser('id') userId: string) {
    return this.service.getQrCode(userId);
  }

  /** Verifica o estado da conexão WhatsApp */
  @Get('instance/status')
  getConnectionStatus(@CurrentUser('id') userId: string) {
    return this.service.getConnectionStatus(userId);
  }

  /** Remove a instância Evolution do usuário */
  @Delete('instance')
  @HttpCode(HttpStatus.OK)
  deleteInstance(@CurrentUser('id') userId: string) {
    return this.service.deleteInstance(userId);
  }
}
