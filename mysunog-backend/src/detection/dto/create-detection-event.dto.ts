import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { DetectionType, SeverityLevel } from '../detection-event.entity';

export class CreateDetectionEventDto {
  @IsEnum(DetectionType)
  detectionType: DetectionType;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @IsEnum(SeverityLevel)
  @IsOptional()
  severity?: SeverityLevel;

  @IsString()
  @IsOptional()
  cameraSource?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsOptional()
  rawDetections?: any;
}
