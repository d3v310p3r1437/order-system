import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

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

  // variant.basePrice-ийг дарж бичих салбарын үнэ (override) —
  // inventory-effective.util.ts-ийн resolveEffectivePrice.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  branchPrice?: number;

  @IsOptional()
  @IsBoolean()
  preOrderEnabledOverride?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  preOrderLeadDaysOverride?: number;
}
