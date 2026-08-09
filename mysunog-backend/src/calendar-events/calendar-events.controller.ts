import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CalendarEventsService } from './calendar-events.service';
import { CalendarEvent } from './calendar-event.entity';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('calendar-events')
export class CalendarEventsController {
  constructor(private readonly calendarEventsService: CalendarEventsService) {}

  @Get()
  async findAll(): Promise<CalendarEvent[]> {
    return this.calendarEventsService.findAll();
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  async create(@Body() data: Partial<CalendarEvent>): Promise<CalendarEvent> {
    return this.calendarEventsService.create(data);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: Partial<CalendarEvent>): Promise<CalendarEvent> {
    return this.calendarEventsService.update(id, data);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.calendarEventsService.remove(id);
  }
}
