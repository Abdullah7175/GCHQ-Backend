import { IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { SectorGridStatus } from '../../common/enums';

export class CreateSectorDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsUUID()
  cityId: string;

  @IsString()
  color: string;

  @IsOptional()
  @IsEnum(SectorGridStatus)
  gridStatus?: SectorGridStatus;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}

export class UpdateSectorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsUUID()
  cityId?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsEnum(SectorGridStatus)
  gridStatus?: SectorGridStatus;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  overrideActive?: boolean;
}
