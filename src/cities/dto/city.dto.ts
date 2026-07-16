import { IsBoolean, IsNumber, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CityConfigDto {
  @IsOptional()
  latencySpeedThresholdKmh?: number;

  @IsOptional()
  maxConcurrentTransits?: number;

  @IsOptional()
  defaultBaselineEtaMinutes?: number;

  @IsOptional()
  @IsString()
  transitIdPrefix?: string;

  @IsOptional()
  @IsBoolean()
  enableSurgeProtocol?: boolean;

  @IsOptional()
  @IsBoolean()
  enableTransitRateKpi?: boolean;

  @IsOptional()
  @IsBoolean()
  privacyRedactPatientData?: boolean;

  @IsOptional()
  commandPriority?: number;
}

export class CreateCityDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  code: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mapCenterLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mapCenterLng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mapDefaultZoom?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CityConfigDto)
  operationalConfig?: CityConfigDto;
}

export class UpdateCityDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mapCenterLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mapCenterLng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mapDefaultZoom?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CityConfigDto)
  operationalConfig?: CityConfigDto;
}
