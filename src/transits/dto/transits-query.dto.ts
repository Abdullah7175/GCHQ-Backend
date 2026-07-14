import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { CityScopedQueryDto } from '../../common/dto/pagination.dto';

export class TransitsQueryDto extends CityScopedQueryDto {
  @IsOptional()
  @IsUUID()
  hospitalId?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  active?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  paginated?: string;
}
