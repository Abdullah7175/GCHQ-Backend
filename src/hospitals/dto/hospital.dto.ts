import { IsArray, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateHospitalDto {
  @IsString()
  name: string;

  @IsUUID()
  cityId: string;

  @IsOptional()
  @IsString()
  address?: string;

  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @IsOptional()
  @IsUUID()
  sectorId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];

  /** Emergency categories this hospital caters (many-to-many) */
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  emergencyTypeIds?: string[];
}

export class UpdateHospitalDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  cityId?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsUUID()
  sectorId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];

  /** Emergency categories this hospital caters (many-to-many) */
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  emergencyTypeIds?: string[];
}

export class SuitableHospitalsQueryDto {
  @IsUUID()
  cityId: string;

  @IsUUID()
  emergencyTypeId: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}
