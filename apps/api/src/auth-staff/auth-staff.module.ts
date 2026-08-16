import { Module } from '@nestjs/common';
import { LoginThrottleService } from '../common/login-throttle.service.js';
import { AuthStaffController } from './auth-staff.controller.js';
import { AuthStaffService } from './auth-staff.service.js';

@Module({
  controllers: [AuthStaffController],
  providers: [AuthStaffService, LoginThrottleService],
})
export class AuthStaffModule {}
