import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { TokenVerifierService } from './token-verifier.service.js';

@Module({
  controllers: [AuthController],
  providers: [TokenVerifierService],
  exports: [TokenVerifierService],
})
export class AuthModule {}
