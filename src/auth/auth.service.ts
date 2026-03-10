import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { RegisterDto, RequestTokenDto, LoginDto, LoginPasswordDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private email: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('Email já cadastrado');

    const hash = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.create({
      data: { name: dto.name, email: dto.email, password: hash },
    });

    return { message: 'Conta criada com sucesso. Faça login para continuar.' };
  }

  async requestToken(dto: RequestTokenDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new NotFoundException('Email não encontrado');

    const token = this.generateToken();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.prisma.user.update({
      where: { id: user.id },
      data: { loginToken: token, loginTokenExpiry: expiry },
    });

    await this.email.sendLoginToken(user.email, token, user.name);

    return { message: 'Token enviado para seu email' };
  }

  async login(dto: LoginDto) {
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

    // Clear the used token
    await this.prisma.user.update({
      where: { id: user.id },
      data: { loginToken: null, loginTokenExpiry: null },
    });

    return this.signJwt(user.id, user.email);
  }

  async loginWithPassword(dto: LoginPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException('Credenciais inválidas');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Credenciais inválidas');

    return this.signJwt(user.id, user.email);
  }

  private signJwt(userId: string, email: string) {
    const token = this.jwt.sign({ sub: userId, email });
    return { access_token: token };
  }

  private generateToken(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
