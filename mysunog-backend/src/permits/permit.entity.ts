import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum PermitStatus {
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  REVISION_REQUIRED = 'revision_required',
  APPROVED = 'approved',
  ISSUED = 'issued',
  RELEASED = 'released',
  REJECTED = 'rejected',
}

export enum PermitType {
  FIRE_PERMIT = 'fire_permit',
  FSIC = 'fsic',
}

@Entity()
export class PermitRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  businessName: string;

  @Column({ default: '' })
  houseNumber: string;

  @Column({ default: '' })
  streetName: string;

  @Column({ default: '' })
  subdivision: string;

  @Column({ default: '' })
  barangay: string;

  @Column({ nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: PermitType,
    default: PermitType.FIRE_PERMIT,
  })
  permitType: PermitType;

  @Column({
    type: 'enum',
    enum: PermitStatus,
    default: PermitStatus.SUBMITTED,
  })
  status: PermitStatus;

  @Column({ nullable: true })
  adminRemarks?: string;

  @Column({ type: 'date', nullable: true })
  expirationDate?: string;

  @Column({ nullable: true })
  bploSlipUrl?: string;

  @Column({ nullable: true })
  inspectionDate?: Date;

  @Column({ nullable: true })
  certificateUrl?: string;

  @ManyToOne(() => User, { eager: true })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
