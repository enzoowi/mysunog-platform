import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AiIncidentStatus } from './enums';

/**
 * AiIncidentStatusHistory — Complete audit trail of every status change.
 *
 * Design notes:
 * - Append-only: rows are never updated or deleted.
 * - The `performedById` is null for system-generated transitions
 *   (e.g., the initial UNVERIFIED status set by the AI webhook).
 * - The `previousStatus` + `newStatus` pair gives a complete picture of
 *   every transition for the thesis audit trail requirement.
 * - Indexed on `incidentId` for fast timeline queries.
 *
 * This table answers the question:
 * "Who did what to this incident, and when?"
 */
@Entity('ai_incident_status_history')
@Index(['incidentId'])
@Index(['changedAt'])
export class AiIncidentStatusHistory {
  @PrimaryGeneratedColumn()
  id: number;

  /** Foreign key to ai_incidents.id (UUID) */
  @Column()
  incidentId: string;

  /**
   * ID of the user who made this change.
   * NULL when the system (AI webhook) sets the initial status.
   */
  @Column({ nullable: true })
  performedById: number;

  /**
   * Denormalized full name — stored so audit records survive user deletion.
   * "System" when set by the AI service.
   */
  @Column({ default: 'System' })
  performedByName: string;

  @Column({
    type: 'enum',
    enum: AiIncidentStatus,
    nullable: true,
  })
  previousStatus: AiIncidentStatus;

  @Column({
    type: 'enum',
    enum: AiIncidentStatus,
  })
  newStatus: AiIncidentStatus;

  /** Optional free-text notes from the BFP officer (e.g., "Verified via camera 2") */
  @Column({ nullable: true })
  remarks: string;

  @CreateDateColumn()
  changedAt: Date;
}
