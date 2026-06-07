import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { StylistController } from './stylist.controller';
import { StylistService } from './stylist.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [StylistController],
  providers: [StylistService],
})
export class StylistModule {}
