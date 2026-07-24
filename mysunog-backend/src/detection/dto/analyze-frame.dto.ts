import { IsString, IsOptional } from 'class-validator';

export class AnalyzeFrameDto {
  @IsString()
  imageBase64: string;

  @IsString()
  @IsOptional()
  cameraId?: string;

  @IsOptional()
  latitude?: number;

  @IsOptional()
  longitude?: number;
}
