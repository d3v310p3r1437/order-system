import { Module } from '@nestjs/common';
import { LoginThrottleService } from '../common/login-throttle.service.js';
import { AuthCustomerController } from './auth-customer.controller.js';
import { AuthCustomerService } from './auth-customer.service.js';

@Module({
  controllers: [AuthCustomerController],
  providers: [AuthCustomerService, LoginThrottleService],
})
export class AuthCustomerModule {}
