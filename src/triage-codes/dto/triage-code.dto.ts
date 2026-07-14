import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateTriageCodeDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsString()
  color: string;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateTriageCodeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsString()
  description?: string;
}
