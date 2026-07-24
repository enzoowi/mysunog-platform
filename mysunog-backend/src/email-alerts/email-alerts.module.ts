import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailRecipient } from './email-recipient.entity';
import { EmailAlertsService } from './email-alerts.service';
import { EmailAlertsController } from './email-alerts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EmailRecipient])],
  controllers: [EmailAlertsController],
  providers: [EmailAlertsService],
  exports: [EmailAlertsService],
})
export class EmailAlertsModule {}
