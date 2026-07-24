import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsEnum,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AiDetectionType, FireGrowthStatus, IncidentPriority } from '../enums';

/**
 * TemporalDataDto — mirrors Python TemporalData schema exactly.
 */
export class TemporalDataDto {
  @IsDateString()
  first_detection_time: string;

  @IsDateString()
  last_detection_time: string;

  @IsNumber()
  duration_seconds: number;

  @IsNumber()
  consecutive_count: number;

  @IsArray()
  @IsNumber({}, { each: true })
  fire_area_history: number[];

  @IsArray()
  @IsNumber({}, { each: true })
  smoke_area_history: number[];

  @IsNumber()
  current_fire_area: number;

  @IsNumber()
  current_smoke_area: number;

  @IsString()
  growth_status: string;

  @IsNumber()
  growth_rate_per_sample: number;
}

/**
 * SeverityReportDto — mirrors Python SeverityReport schema exactly.
 */
export class SeverityReportDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;

  @IsString()
  level: string;

  @IsArray()
  @IsString({ each: true })
  reasons: string[];

  @IsNumber()
  fire_area_pct: number;

  @IsNumber()
  smoke_area_pct: number;

  @IsNumber()
  max_confidence: number;
}

/**
 * CreateAiIncidentDto — the payload POSTed by the AI service webhook.
 * Uses snake_case to match the Python serialization format.
 */
export class CreateAiIncidentDto {
  // ── Camera ───────────────────────────────────────────────────────────────
  @IsString()
  camera_id: string;

  @IsOptional()
  @IsString()
  camera_name?: string;

  @IsOptional()
  @IsString()
  camera_location?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  // ── Detection Summary ─────────────────────────────────────────────────
  @IsString()
  detection_type: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  max_confidence: number;

  // ── Temporal ──────────────────────────────────────────────────────────
  @Type(() => TemporalDataDto)
  temporal: TemporalDataDto;

  // ── Severity ──────────────────────────────────────────────────────────
  @Type(() => SeverityReportDto)
  severity: SeverityReportDto;

  // ── Priority ──────────────────────────────────────────────────────────
  @IsString()
  priority: string;

  // ── Update flag ───────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  existing_incident_id?: string;
}
