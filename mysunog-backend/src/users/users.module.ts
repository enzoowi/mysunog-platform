import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './user.entity';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RolesGuard } from '../auth/roles.guard';
import { SmsAlertsModule } from '../sms-alerts/sms-alerts.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), EmailModule, NotificationsModule, SmsAlertsModule],
  providers: [UsersService, RolesGuard],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
