import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateInspectionDto {
  @IsString()
  @IsNotEmpty()
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

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  bploSlipUrl?: string;
}
