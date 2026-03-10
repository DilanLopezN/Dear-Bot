import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, RequestTokenDto, LoginDto, LoginPasswordDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('request-token')
  requestToken(@Body() dto: RequestTokenDto) {
    return this.auth.requestToken(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('login-password')
  loginWithPassword(@Body() dto: LoginPasswordDto) {
    return this.auth.loginWithPassword(dto);
  }
}
