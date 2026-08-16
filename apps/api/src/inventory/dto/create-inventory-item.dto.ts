import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateInventoryItemDto {
  @IsUUID()
  variantId!: string;

  @IsUUID()
  branchId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;
}
