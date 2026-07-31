import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

@Entity()
export class FireIncident {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  incidentDate: string;

  @Column()
  incidentTime: string;

  @Column()
  barangay: string;

  @Column({ nullable: true })
  cause?: string;

  @Column('decimal', { precision: 10, scale: 7 })
  latitude: number;

  @Column('decimal', { precision: 10, scale: 7 })
  longitude: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  estimatedDamage?: number;

  @Column({ nullable: true })
  casualties?: number;

  @Column({ nullable: true })
  injuries?: number;

  @Column({ nullable: true })
  propertyType?: string;

  @Column({ nullable: true })
  landmark?: string;

  @Column({ nullable: true })
  remarks?: string;

  @Column({ nullable: true })
  reporterName?: string;

  @Column({ nullable: true })
  reporterContact?: string;

  @Column({ nullable: true })
  fireInvestigator?: string;

  // Response performance fields
  @Column({ nullable: true })
  alarmTime?: string;

  @Column({ nullable: true })
  responseTime?: string;

  @Column({ nullable: true })
  controlTime?: string;

  @Column({ nullable: true })
  fireOutTime?: string;

  /** Optional photo URL for map popup display */
  @Column({ nullable: true })
  photoUrl?: string;

  /** Optional array of image URLs of the incident */
  @Column('text', { array: true, nullable: true })
  images?: string[];

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
