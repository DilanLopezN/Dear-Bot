import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { RegisterDto, RequestTokenDto, LoginDto, LoginPasswordDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private email: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    this.logger.log(`Tentativa de registro: ${dto.email}`);
    try {
      const exists = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (exists) throw new ConflictException('Email já cadastrado');

      const hash = await bcrypt.hash(dto.password, 10);
      const planExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 dias
      await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: hash,
          plan: 'TESTER',
          planExpiresAt,
          planActive: true,
        },
      });

      this.logger.log(`Usuário registrado com sucesso: ${dto.email}`);
      return { message: 'Conta criada com sucesso. Faça login para continuar.' };
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      this.logger.error(`Erro ao registrar usuário ${dto.email}: ${err.message}`, err.stack);
      throw err;
    }
  }

  async requestToken(dto: RequestTokenDto) {
    this.logger.log(`Solicitação de token para: ${dto.email}`);
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (!user) throw new NotFoundException('Email não encontrado');

      const token = this.generateToken();
      const expiry = new Date(Date.now() + 15 * 60 * 1000);

      await this.prisma.user.update({
        where: { id: user.id },
        data: { loginToken: token, loginTokenExpiry: expiry },
      });

      await this.email.sendLoginToken(user.email, token, user.name);

      this.logger.log(`Token enviado para: ${dto.email}`);
      return { message: 'Token enviado para seu email' };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error(`Erro ao enviar token para ${dto.email}: ${err.message}`, err.stack);
      throw err;
    }
  }

  async login(dto: LoginDto) {
    this.logger.log(`Tentativa de login com token: ${dto.email}`);
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (!user) throw new UnauthorizedException('Credenciais inválidas');

      if (
        !user.loginToken ||
        !user.loginTokenExpiry ||
        user.loginToken !== dto.token ||
        user.loginTokenExpiry < new Date()
      ) {
        throw new UnauthorizedException('Token inválido ou expirado');
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: { loginToken: null, loginTokenExpiry: null },
      });

      this.logger.log(`Login com token bem-sucedido: ${dto.email}`);
      return await this.signJwt(user.id, user.email);
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.error(`Erro no login com token ${dto.email}: ${err.message}`, err.stack);
      throw err;
    }
  }

  async loginWithPassword(dto: LoginPasswordDto) {
    this.logger.log(`Tentativa de login com senha: ${dto.email}`);
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (!user) throw new UnauthorizedException('Credenciais inválidas');

      const valid = await bcrypt.compare(dto.password, user.password);
      if (!valid) throw new UnauthorizedException('Credenciais inválidas');

      this.logger.log(`Login com senha bem-sucedido: ${dto.email}`);
      return await this.signJwt(user.id, user.email);
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.error(`Erro no login com senha ${dto.email}: ${err.message}`, err.stack);
      throw err;
    }
  }

  private async signJwt(userId: string, email: string) {
    const token = this.jwt.sign({ sub: userId, email });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, planActive: true, planExpiresAt: true },
    });
    return {
      access_token: token,
      plan: user?.plan,
      planActive: user?.planActive,
      planExpiresAt: user?.planExpiresAt,
    };
  }

  private generateToken(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
