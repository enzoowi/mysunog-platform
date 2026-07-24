import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InspectionsController } from './inspections.controller';
import { InspectionsService } from './inspections.service';
import { Inspection } from './inspection.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Inspection]),
    NotificationsModule,
    UsersModule,
    EmailModule,
  ],
  controllers: [InspectionsController],
  providers: [InspectionsService],
})
export class InspectionsModule {}
