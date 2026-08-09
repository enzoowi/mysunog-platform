import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmsRecipient } from './sms-recipient.entity';
import { SmsAlertsService } from './sms-alerts.service';
import { SmsAlertsController } from './sms-alerts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SmsRecipient])],
  controllers: [SmsAlertsController],
  providers: [SmsAlertsService],
  exports: [SmsAlertsService],
})
export class SmsAlertsModule {}
