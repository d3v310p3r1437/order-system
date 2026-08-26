import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_REVIEW_PAGE_SIZE = 20;
export const MAX_REVIEW_PAGE_SIZE = 100;

export class ReviewQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_REVIEW_PAGE_SIZE)
  limit?: number;
}
