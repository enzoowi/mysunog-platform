import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum CameraType {
  WEBCAM = 'webcam',
  RTSP = 'rtsp',
  UPLOAD = 'upload',
}

@Entity('cameras')
export class Camera {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  location: string;

  /** Stream URL for RTSP cameras (null for webcam/upload) */
  @Column({ nullable: true })
  streamUrl: string;

  @Column({
    type: 'enum',
    enum: CameraType,
    default: CameraType.WEBCAM,
  })
  type: CameraType;

  @Column('decimal', { precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column('decimal', { precision: 10, scale: 7, nullable: true })
  longitude: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
