import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
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
  @Type(() => Number)
  @IsNumber()
  originLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  originLng?: number;

  @IsOptional()
  @Type(() => Number)
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
  @Type(() => Number)
  @IsNumber()
  etaMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  currentLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  currentLng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  currentSpeed?: number;
}

/** Driver mobile: push live ETA (and optional GPS fields) onto the transit */
export class UpdateTransitEtaDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  etaMinutes: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  currentLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  currentLng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentSpeed?: number;
}

export class StartTransitDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  currentLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  currentLng?: number;
}
