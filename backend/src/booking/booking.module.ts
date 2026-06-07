import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { MemberModule } from '../member/member.module';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';

@Module({
  imports: [AuthModule, DatabaseModule, MemberModule],
  controllers: [BookingController],
  providers: [BookingService],
})
export class BookingModule {}
