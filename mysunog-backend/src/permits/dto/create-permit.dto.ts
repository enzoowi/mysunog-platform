import {
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { PermitType } from '../permit.entity';

export class CreatePermitDto {
  @IsString()
  @MinLength(2)
  businessName: string;

  @IsString()
  @IsNotEmpty()
  houseNumber: string;

  @IsString()
  @IsNotEmpty()
  streetName: string;

  @IsString()
  @IsOptional()
  subdivision: string;

  @IsString()
  @IsNotEmpty()
  barangay: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @IsEnum(PermitType)
  permitType?: PermitType;

  @IsOptional()
  @IsString()
  bploSlipUrl?: string;
}
