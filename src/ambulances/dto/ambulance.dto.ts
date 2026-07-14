import { IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
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
  @IsNumber()
  currentLat?: number;

  @IsOptional()
  @IsNumber()
  currentLng?: number;

  @IsOptional()
  @IsUUID()
  driverId?: string;
}

export class UpdateAmbulanceDto {
  @IsOptional()
  @IsString()
  unitNumber?: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsEnum(AmbulanceStatus)
  status?: AmbulanceStatus;

  @IsOptional()
  @IsNumber()
  currentLat?: number;

  @IsOptional()
  @IsNumber()
  currentLng?: number;

  @IsOptional()
  @IsNumber()
  currentSpeed?: number;

  @IsOptional()
  @IsUUID()
  driverId?: string;
}

export class UpdateGpsDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsOptional()
  @IsNumber()
  speed?: number;

  @IsOptional()
  @IsNumber()
  heading?: number;
}
