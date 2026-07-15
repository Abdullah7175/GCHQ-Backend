import { IsArray, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateHospitalDto {
  @IsString()
  name: string;

  @IsUUID()
  cityId: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsUUID()
  sectorId?: string;

  @IsOptional()
  @IsNumber()
  bedCapacity?: number;

  @IsOptional()
  @IsNumber()
  erBays?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];
}

export class UpdateHospitalDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsUUID()
  sectorId?: string;

  @IsOptional()
  @IsNumber()
  bedCapacity?: number;

  @IsOptional()
  @IsNumber()
  erBays?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];
}

