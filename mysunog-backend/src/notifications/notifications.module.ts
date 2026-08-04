import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { Notification } from './notification.entity';
import { Camera } from '../detection/camera.entity';
import { AiIncident } from '../ai-incidents/ai-incident.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, Camera, AiIncident])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
