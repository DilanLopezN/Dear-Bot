import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['x-admin-token'];

    if (!authHeader) {
      throw new UnauthorizedException('Token de admin não fornecido');
    }

    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD');
    if (!adminPassword) {
      throw new UnauthorizedException('Senha de admin não configurada no servidor');
    }

    if (authHeader !== adminPassword) {
      throw new UnauthorizedException('Token de admin inválido');
    }

    return true;
  }
}
