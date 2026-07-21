import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';
import { MessagingChannel } from '../messaging-provider-config.entity';

export class CreateMessagingProviderDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEnum(MessagingChannel)
  channel: MessagingChannel;

  @IsUrl({ require_tld: false })
  apiUrl: string;

  @IsString()
  @MinLength(1)
  secretKey: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** JSON field for auth value in POST body (default token) */
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z_][a-zA-Z0-9_]*$/, { message: 'Auth field must be a valid JSON key name' })
  authFieldName?: string;
}

export class UpdateMessagingProviderDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEnum(MessagingChannel)
  channel?: MessagingChannel;

  @IsOptional()
  @IsUrl({ require_tld: false })
  apiUrl?: string;

  /** Omit or empty to keep existing encrypted secret */
  @IsOptional()
  @IsString()
  secretKey?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z_][a-zA-Z0-9_]*$/, { message: 'Auth field must be a valid JSON key name' })
  authFieldName?: string;
}

export class TestMessagingDto {
  @IsString()
  @Matches(/^\+?\d+$/, { message: 'Phone may only contain + and digits' })
  phone: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  message?: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  apiUrl?: string;

  @IsOptional()
  @IsString()
  secretKey?: string;

  @IsOptional()
  @IsEnum(MessagingChannel)
  channel?: MessagingChannel;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
  authFieldName?: string;
}
