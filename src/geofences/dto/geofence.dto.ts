import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GeofenceShapeType } from '../geofence.enums';

export class GeofencePointDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;
}

export class UpsertHospitalGeofenceDto {
  @IsEnum(GeofenceShapeType)
  shapeType: GeofenceShapeType;

  @IsOptional()
  @IsNumber()
  centerLat?: number;

  @IsOptional()
  @IsNumber()
  centerLng?: number;

  @IsOptional()
  @IsInt()
  @Min(25)
  @Max(5000)
  radiusMeters?: number;

  @IsArray()
  @ArrayMinSize(3)
  @ValidateNested({ each: true })
  @Type(() => GeofencePointDto)
  points: GeofencePointDto[];
}
