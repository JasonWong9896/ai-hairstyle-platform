import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { EmailService } from './email.service';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, EmailService],
  exports: [AuthService, EmailService],
})
export class AuthModule {}
