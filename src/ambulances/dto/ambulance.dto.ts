import { IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { AmbulanceStatus } from '../../common/enums';

export class CreateAmbulanceDto {
  @IsString()
  unitNumber: string;

  @IsUUID()
  cityId: string;

  @IsUUID()
  providerId: string;

  @IsOptional()
  @IsEnum(AmbulanceStatus)
  status?: AmbulanceStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  currentLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  currentLng?: number;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsString()
  gpsUrl?: string;

  @IsOptional()
  @IsString()
  gpsHeaders?: string;
}

export class UpdateAmbulanceDto {
  @IsOptional()
  @IsString()
  unitNumber?: string;

  @IsOptional()
  @IsUUID()
  cityId?: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsEnum(AmbulanceStatus)
  status?: AmbulanceStatus;

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

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsString()
  gpsUrl?: string;

  @IsOptional()
  @IsString()
  gpsHeaders?: string;
}

/** Live GPS ping from driver mobile / web — call every ~15 seconds */
export class UpdateGpsDto {
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  speed?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  heading?: number;

  /** Optional active trip id; server also auto-attaches the ambulance's open transit */
  @IsOptional()
  @IsUUID()
  transitId?: string;
}
