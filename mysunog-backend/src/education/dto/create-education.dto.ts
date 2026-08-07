import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { EducationCategory } from '../education.entity';

export class CreateEducationDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsEnum(EducationCategory)
  category: EducationCategory;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
