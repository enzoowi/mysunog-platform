import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum EducationCategory {
  ANNOUNCEMENT = 'announcement',
  GENERAL = 'general',
  PREVENTION = 'prevention',
  LPG = 'lpg',
  EMERGENCY = 'emergency',
  HOME_SAFETY = 'home_safety',
}

@Entity()
export class EducationContent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column('text')
  content: string;

  @Column({
    type: 'enum',
    enum: EducationCategory,
    default: EducationCategory.GENERAL,
  })
  category: EducationCategory;

  @Column({ nullable: true })
  imageUrl?: string;

  @CreateDateColumn()
  createdAt: Date;
}
