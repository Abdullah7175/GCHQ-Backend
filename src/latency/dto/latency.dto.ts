import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min, MinLength } from 'class-validator';
import { UserRole } from '../../common/enums';
import { LatencyBreachType, LatencyNotifyChannel } from '../latency.enums';

export class CreateLatencyRuleDto {
  @IsString()
  name: string;

  @IsEnum(LatencyBreachType)
  breachType: LatencyBreachType;

  @IsUUID()
  cityId: string;

  @IsOptional()
  @IsUUID()
  sectorId?: string | null;

  @IsOptional()
  @IsEnum(UserRole)
  targetRole?: UserRole | null;

  @IsInt()
  @Min(1)
  thresholdMinutes: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLatencyRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(LatencyBreachType)
  breachType?: LatencyBreachType;

  @IsOptional()
  @IsUUID()
  cityId?: string;

  @IsOptional()
  @IsUUID()
  sectorId?: string | null;

  @IsOptional()
  @IsEnum(UserRole)
  targetRole?: UserRole | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  thresholdMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateLatencyRecipientDto {
  @IsUUID()
  ruleId: string;

  @IsString()
  name: string;

  @IsString()
  @Matches(/^\+?\d+$/, { message: 'Phone may only contain + and digits' })
  phone: string;

  @IsOptional()
  @IsEnum(LatencyNotifyChannel)
  channel?: LatencyNotifyChannel;

  /** How many alerts to send for one breach (1–10). Default 1. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  notificationCount?: number;

  /** Minutes between alerts when notificationCount > 1. Default 15. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  notificationIntervalMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLatencyRecipientDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?\d+$/, { message: 'Phone may only contain + and digits' })
  phone?: string;

  @IsOptional()
  @IsEnum(LatencyNotifyChannel)
  channel?: LatencyNotifyChannel;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  notificationCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  notificationIntervalMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
