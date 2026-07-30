import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../users/user.entity';

export type NotificationType = 'ai_alert' | 'alert' | 'system' | 'general';

@Entity()
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column('text')
  message: string;

  @Column({ default: false })
  isRead: boolean;

  /** Categorises the notification so the frontend can apply special styling. */
  @Column({ default: 'general' })
  type: NotificationType;

  /**
   * Optional frontend route to navigate to when the user clicks the notification
   * e.g. '/admin/ai-incidents/abc-123'
   */
  @Column({ nullable: true, type: 'text' })
  link: string | null;

  /** URL of the captured frame */
  @Column({ nullable: true })
  imageUrl: string | null;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}
