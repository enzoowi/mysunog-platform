import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { FireIncident } from './fire-incident.entity';
import { RolesGuard } from '../auth/roles.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([FireIncident]), NotificationsModule, UsersModule],
  controllers: [IncidentsController],
  providers: [IncidentsService, RolesGuard],
})
export class IncidentsModule {}
