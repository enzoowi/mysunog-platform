import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PermitStatus } from '../permit.entity';

export class UpdatePermitStatusDto {
  @IsEnum(PermitStatus)
  status: PermitStatus;

  @IsOptional()
  @IsString()
  adminRemarks?: string;

  @IsOptional()
  @IsString()
  inspectionDate?: string;
}
