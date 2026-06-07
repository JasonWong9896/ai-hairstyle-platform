import { Module } from '@nestjs/common';

import { UploadModule } from './upload/upload.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { BookingModule } from './booking/booking.module';
import { DatabaseModule } from './database/database.module';
import { MemberModule } from './member/member.module';
import { SalonModule } from './salon/salon.module';
import { StylistModule } from './stylist/stylist.module';

@Module({
  imports: [DatabaseModule, AuthModule, UploadModule, AiModule, SalonModule, MemberModule, BookingModule, StylistModule],
})
export class AppModule {}
