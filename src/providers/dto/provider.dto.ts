import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ProviderShape } from '../../common/enums';

export class CreateProviderDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsEnum(ProviderShape)
  shape: ProviderShape;

  @IsString()
  color: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateProviderDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsEnum(ProviderShape)
  shape?: ProviderShape;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
