import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalendarEvent } from './calendar-event.entity';

@Injectable()
export class CalendarEventsService {
  constructor(
    @InjectRepository(CalendarEvent)
    private readonly eventRepo: Repository<CalendarEvent>,
  ) {}

  async findAll(): Promise<CalendarEvent[]> {
    return this.eventRepo.find({ order: { date: 'ASC' } });
  }

  async findOne(id: string): Promise<CalendarEvent> {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException(`CalendarEvent with ID ${id} not found`);
    }
    return event;
  }

  async create(data: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const event = this.eventRepo.create(data);
    return this.eventRepo.save(event);
  }

  async update(id: string, data: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const event = await this.findOne(id);
    Object.assign(event, data);
    return this.eventRepo.save(event);
  }

  async remove(id: string): Promise<void> {
    const event = await this.findOne(id);
    await this.eventRepo.remove(event);
  }
}
