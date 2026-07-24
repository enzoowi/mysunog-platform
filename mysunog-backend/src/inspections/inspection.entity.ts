import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum InspectionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  ISSUED = 'issued',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

@Entity()
export class Inspection {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true })
  requestedBy: User;

  @Column({ default: '' })
  businessName: string;

  @Column({ default: '' })
  houseNumber: string;

  @Column({ default: '' })
  streetName: string;

  @Column({ default: '' })
  subdivision: string;

  @Column()
  barangay: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  bploSlipUrl?: string;

  @Column({
    type: 'enum',
    enum: InspectionStatus,
    default: InspectionStatus.PENDING,
  })
  status: InspectionStatus;

  @Column({ nullable: true })
  adminNotes?: string;

  @Column({ nullable: true })
  scheduledDate?: string;

  @Column({ nullable: true })
  scheduledTime?: string;

  @Column({ nullable: true })
  certificateUrl?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
