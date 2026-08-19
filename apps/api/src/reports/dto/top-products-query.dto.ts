import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ReportDateRangeQueryDto } from './report-date-range-query.dto.js';

export const DEFAULT_TOP_PRODUCTS_LIMIT = 10;

export class TopProductsQueryDto extends ReportDateRangeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
