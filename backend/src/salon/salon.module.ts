import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SalonController } from './salon.controller';
import { SalonService } from './salon.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [SalonController],
  providers: [SalonService],
})
export class SalonModule {}
