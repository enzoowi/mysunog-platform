import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermitsController } from './permits.controller';
import { PermitsService } from './permits.service';
import { PermitRequest } from './permit.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PermitRequest]),
    NotificationsModule,
    UsersModule,
    EmailModule,
  ],
  controllers: [PermitsController],
  providers: [PermitsService],
})
export class PermitsModule {}
