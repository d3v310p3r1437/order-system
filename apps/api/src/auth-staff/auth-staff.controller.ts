import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { decodeJwt } from 'jose';
import { Audit } from '../common/audit.decorator.js';
import { AuthStaffService, type StaffTokenPair } from './auth-staff.service.js';
import { LoginDto } from './dto/login.dto.js';

// register/login-ийн хариу нь token хос (id талбар агуулдаггүй) тул
// @Audit-ийн recordId-г шинээр гаргасан accessToken-ийн `local_user_id`
// claim-аас уншина (auth/token-verifier.service.ts-тэй ижил claim, Keycloak
// protocol mapper-ээр тавигдсан) — signature дахин баталгаажуулах
// шаардлагагүй, зөвхөн audit лог бичихэд ашиглах учир decodeJwt хангалттай.
function recordIdFromIssuedToken(
  _req: unknown,
  body: unknown,
): string | undefined {
  const accessToken = (body as Partial<StaffTokenPair> | undefined)
    ?.accessToken;
  if (!accessToken) {
    return undefined;
  }
  const { local_user_id: localUserId } = decodeJwt(accessToken);
  return typeof localUserId === 'string' ? localUserId : undefined;
}

@Controller('auth/staff')
export class AuthStaffController {
  constructor(private readonly authStaff: AuthStaffService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Audit('users', { action: 'staff.login', recordId: recordIdFromIssuedToken })
  login(@Body() dto: LoginDto) {
    return this.authStaff.login(dto.email, dto.password);
  }
}
