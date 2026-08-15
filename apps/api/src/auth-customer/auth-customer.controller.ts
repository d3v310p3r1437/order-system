import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { decodeJwt } from 'jose';
import { Audit } from '../common/audit.decorator.js';
import {
  AuthCustomerService,
  type CustomerTokenPair,
} from './auth-customer.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { RegisterDto } from './dto/register.dto.js';

// register/login-ийн хариу нь token хос (id талбар агуулдаггүй) тул
// @Audit-ийн recordId-г шинээр гаргасан accessToken-ийн `sub` claim-аас
// уншина — signature дахин баталгаажуулах шаардлагагүй (энэ хүсэлт өөрөө
// AuthCustomerService-ээр аль хэдийн зөв гарын үсэг зурсан), зөвхөн audit
// лог бичихэд ашиглах учир decodeJwt (verify биш) хангалттай.
function recordIdFromIssuedToken(
  _req: unknown,
  body: unknown,
): string | undefined {
  const accessToken = (body as Partial<CustomerTokenPair> | undefined)
    ?.accessToken;
  if (!accessToken) {
    return undefined;
  }
  const { sub } = decodeJwt(accessToken);
  return sub;
}

@Controller('auth/customer')
export class AuthCustomerController {
  constructor(private readonly authCustomer: AuthCustomerService) {}

  @Post('register')
  @Audit('users', {
    action: 'user.registered',
    recordId: recordIdFromIssuedToken,
  })
  register(@Body() dto: RegisterDto) {
    return this.authCustomer.register(dto.phone, dto.password);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Audit('users', { action: 'user.login', recordId: recordIdFromIssuedToken })
  login(@Body() dto: LoginDto) {
    return this.authCustomer.login(dto.phone, dto.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.authCustomer.refresh(dto.refreshToken);
  }
}
