import { Module } from '@nestjs/common';
import { AuthCustomerController } from './auth-customer.controller.js';
import { AuthCustomerService } from './auth-customer.service.js';
import { LoginThrottleService } from './login-throttle.service.js';

@Module({
  controllers: [AuthCustomerController],
  providers: [AuthCustomerService, LoginThrottleService],
})
export class AuthCustomerModule {}
