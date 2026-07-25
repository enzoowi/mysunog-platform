import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiIncident } from './ai-incident.entity';
import { AiIncidentStatusHistory } from './ai-incident-status-history.entity';
import { AiIncidentsService } from './ai-incidents.service';
import { AiIncidentsController } from './ai-incidents.controller';
import { DetectionModule } from '../detection/detection.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailAlertsModule } from '../email-alerts/email-alerts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiIncident, AiIncidentStatusHistory]),
    // Import DetectionModule so we can inject DetectionGateway
    // for broadcasting Socket.IO events on incident create/update.
    DetectionModule,
    UsersModule,
    NotificationsModule,
    EmailAlertsModule,
  ],
  controllers: [AiIncidentsController],
  providers:   [AiIncidentsService],
  exports:     [AiIncidentsService],
})
export class AiIncidentsModule {}
