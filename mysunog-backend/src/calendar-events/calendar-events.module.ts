import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarEvent } from './calendar-event.entity';
import { CalendarEventsService } from './calendar-events.service';
import { CalendarEventsController } from './calendar-events.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CalendarEvent])],
  controllers: [CalendarEventsController],
  providers: [CalendarEventsService],
  exports: [CalendarEventsService],
})
export class CalendarEventsModule {}
