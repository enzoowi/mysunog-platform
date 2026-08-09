import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { NotificationsModule } from './notifications/notifications.module';
import { IncidentsModule } from './incidents/incidents.module';
import { ChatbotModule } from './chatbot/chatbot.module';
import { AlertsModule } from './alerts/alerts.module';
import { EducationModule } from './education/education.module';
import { HotlinesModule } from './hotlines/hotlines.module';
import { ReportsModule } from './reports/reports.module';
import { SiteImagesModule } from './site-images/site-images.module';
import { MapAssetsModule } from './map-assets/map-assets.module';
import { DetectionModule } from './detection/detection.module';
import { RiskMapModule } from './risk-map/risk-map.module';
import { AiIncidentsModule } from './ai-incidents/ai-incidents.module';
import { SmsAlertsModule } from './sms-alerts/sms-alerts.module';
import { UploadModule } from './upload/upload.module';
import { CalendarEventsModule } from './calendar-events/calendar-events.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      autoLoadEntities: true,
      synchronize: true,
      ssl: process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : false,
    }),
    UsersModule,
    AuthModule,
    NotificationsModule,
    IncidentsModule,
    ChatbotModule,
    AlertsModule,
    EducationModule,
    HotlinesModule,
    ReportsModule,
    SiteImagesModule,
    MapAssetsModule,
    DetectionModule,
    RiskMapModule,
    AiIncidentsModule,
    SmsAlertsModule,
    UploadModule,
    CalendarEventsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
