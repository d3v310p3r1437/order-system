import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthCustomerService } from './auth-customer.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@Controller('auth/customer')
export class AuthCustomerController {
  constructor(private readonly authCustomer: AuthCustomerService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authCustomer.register(dto.phone, dto.password);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authCustomer.login(dto.phone, dto.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.authCustomer.refresh(dto.refreshToken);
  }
}
