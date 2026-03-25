import {
  Controller,
  Get,
  Put,
  Delete,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { AdminLoginDto, UpdateUserDto, UpdateUserPlanDto } from './dto/admin.dto';
import { ConfigService } from '@nestjs/config';

@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private configService: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: AdminLoginDto) {
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD');
    if (!adminPassword || dto.password !== adminPassword) {
      return { success: false, message: 'Senha incorreta' };
    }
    return { success: true, token: adminPassword };
  }

  @Get('dashboard')
  @UseGuards(AdminAuthGuard)
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('users')
  @UseGuards(AdminAuthGuard)
  getUsers(
    @Query('search') search?: string,
    @Query('plan') plan?: string,
    @Query('active') active?: string,
  ) {
    return this.adminService.getAllUsers(search, plan, active);
  }

  @Get('users/:id')
  @UseGuards(AdminAuthGuard)
  getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  @Put('users/:id')
  @UseGuards(AdminAuthGuard)
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.adminService.updateUser(id, dto);
  }

  @Put('users/:id/plan')
  @UseGuards(AdminAuthGuard)
  updateUserPlan(@Param('id') id: string, @Body() dto: UpdateUserPlanDto) {
    return this.adminService.updateUserPlan(id, dto.plan, dto.planActive, dto.planDays);
  }

  @Delete('users/:id')
  @UseGuards(AdminAuthGuard)
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }
}
