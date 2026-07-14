import { IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { PrepStatus, TransitStatus } from '../../common/enums';

export class CreateTransitDto {
  @IsUUID()
  ambulanceId: string;

  @IsUUID()
  hospitalId: string;

  @IsUUID()
  emergencyTypeId: string;

  @IsUUID()
  triageCodeId: string;

  @IsOptional()
  @IsUUID()
  sectorId?: string;

  @IsOptional()
  @IsString()
  paramedicNotes?: string;

  @IsOptional()
  @IsNumber()
  originLat?: number;

  @IsOptional()
  @IsNumber()
  originLng?: number;

  @IsOptional()
  @IsNumber()
  baselineEtaMinutes?: number;
}

export class UpdateTransitDto {
  @IsOptional()
  @IsEnum(TransitStatus)
  status?: TransitStatus;

  @IsOptional()
  @IsEnum(PrepStatus)
  prepStatus?: PrepStatus;

  @IsOptional()
  @IsString()
  paramedicNotes?: string;

  @IsOptional()
  @IsNumber()
  etaMinutes?: number;

  @IsOptional()
  @IsNumber()
  currentLat?: number;

  @IsOptional()
  @IsNumber()
  currentLng?: number;

  @IsOptional()
  @IsNumber()
  currentSpeed?: number;
}

export class StartTransitDto {
  @IsOptional()
  @IsNumber()
  currentLat?: number;

  @IsOptional()
  @IsNumber()
  currentLng?: number;
}
