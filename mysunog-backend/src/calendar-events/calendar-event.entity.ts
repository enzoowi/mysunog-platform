import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class CalendarEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'date' })
  date: string; // YYYY-MM-DD format

  @Column({ nullable: true })
  time: string;

  @Column({ nullable: true })
  location: string;

  @Column()
  type: string; // 'training' | 'inspection' | 'community' | 'drill'

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
