import { IsDateString, IsOptional } from 'class-validator';

export class TransitHistoryQueryDto {
  /** Inclusive start date (ISO date or datetime) — filters startedAt */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Inclusive end date (ISO date or datetime) — filters startedAt */
  @IsOptional()
  @IsDateString()
  to?: string;
}
