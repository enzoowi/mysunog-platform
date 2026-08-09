import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  BFP_STAFF = 'bfp_staff',
  FIRE_INVESTIGATOR = 'fire_investigator',
  ADMIN = 'admin',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.BFP_STAFF,
  })
  role: UserRole;

  @Column({ nullable: true })
  firstName?: string;

  @Column({ nullable: true })
  middleName?: string;

  @Column({ nullable: true })
  lastName?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  barangay?: string;

  /** Whether the account is verified/active (used for BFP accounts) */
  @Column({ default: true })
  isVerified: boolean;

  /** Whether this user has submitted a forgot-password request */
  @Column({ default: false })
  passwordResetRequested: boolean;

  /** Timestamp when the password reset was requested */
  @Column({ nullable: true, type: 'timestamp' })
  passwordResetRequestedAt?: Date;

  /** Whether the account requires an OTP to login */
  @Column({ default: false })
  requiresOtp: boolean;

  /** Temporary storage for OTP code (should ideally be hashed or stored in redis in a production app) */
  @Column({ nullable: true })
  otpCode?: string;

  /** Expiration timestamp for the OTP code */
  @Column({ nullable: true, type: 'timestamp' })
  otpExpiresAt?: Date;

  /** Whether this account is active. Admins can deactivate/reactivate. */
  @Column({ default: true })
  isActive: boolean;

  /** Timestamp when the account was deactivated */
  @Column({ nullable: true, type: 'timestamp' })
  deactivatedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
