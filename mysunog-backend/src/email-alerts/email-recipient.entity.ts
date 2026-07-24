import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class EmailRecipient {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  emailAddress: string;

  @Column({ nullable: true })
  name: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
