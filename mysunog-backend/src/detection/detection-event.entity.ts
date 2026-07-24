import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum DetectionType {
  FIRE = 'fire',
  SMOKE = 'smoke',
}

export enum SeverityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('detection_events')
@Index(['createdAt'])
@Index(['severity'])
@Index(['detectionType'])
export class DetectionEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: DetectionType,
  })
  detectionType: DetectionType;

  @Column('decimal', { precision: 5, scale: 4 })
  confidence: number;

  @Column({
    type: 'enum',
    enum: SeverityLevel,
    default: SeverityLevel.LOW,
  })
  severity: SeverityLevel;

  /** Camera or source that generated this detection */
  @Column({ default: 'webcam' })
  cameraSource: string;

  /** GPS coordinates (optional, set if camera has known location) */
  @Column('decimal', { precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column('decimal', { precision: 10, scale: 7, nullable: true })
  longitude: number;

  /** Whether this detection was confirmed (passed consecutive frame check) */
  @Column({ default: true })
  isConfirmed: boolean;

  /** ID of a linked FireIncident if one was auto-created */
  @Column({ nullable: true })
  linkedIncidentId: number;

  /** Raw detection data from the AI service */
  @Column('jsonb', { nullable: true })
  rawDetections: any;

  @CreateDateColumn()
  createdAt: Date;
}
