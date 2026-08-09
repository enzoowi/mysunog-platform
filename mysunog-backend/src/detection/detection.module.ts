import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DetectionEvent } from './detection-event.entity';
import { Camera } from './camera.entity';
import { DetectionService } from './detection.service';
import { DetectionController } from './detection.controller';
import { DetectionGateway } from './detection.gateway';
import { SmsAlertsModule } from '../sms-alerts/sms-alerts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([DetectionEvent, Camera]), SmsAlertsModule, NotificationsModule, UsersModule],
  controllers: [DetectionController],
  providers: [DetectionService, DetectionGateway],
  exports: [DetectionService, DetectionGateway],
})
export class DetectionModule { }
