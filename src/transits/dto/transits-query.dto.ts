import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';
import { CityScopedQueryDto } from '../../common/dto/pagination.dto';

export class TransitsQueryDto extends CityScopedQueryDto {
  @IsOptional()
  @IsUUID()
  hospitalId?: string;

  @IsOptional()
  @IsUUID()
  ambulanceId?: string;

  /** pending | en_route | arrived | completed | cancelled */
  @IsOptional()
  @IsIn(['pending', 'en_route', 'arrived', 'completed', 'cancelled'])
  status?: string;

  /** Inclusive start date (ISO date or datetime) — filters startedAt */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Inclusive end date (ISO date or datetime) — filters startedAt */
  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  active?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  paginated?: string;
}
