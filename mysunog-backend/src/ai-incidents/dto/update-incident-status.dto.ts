import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AiIncidentStatus } from '../enums';

/**
 * UpdateIncidentStatusDto — used by BFP officers to transition incident status.
 * Called on PATCH /ai/incidents/:id/status
 */
export class UpdateIncidentStatusDto {
  @IsEnum(AiIncidentStatus)
  status: AiIncidentStatus;

  /** Optional remarks from the officer (stored in audit trail) */
  @IsOptional()
  @IsString()
  remarks?: string;
}
