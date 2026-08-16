import { IsBoolean, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

// Санамж: `quantity` энд ЗОРИУДАА байхгүй — "адаг тоогоор солих" биш
// "нэмэх/хасах" (delta) байдлаар л өөрчлөгдөх ёстой тул зөвхөн
// InventoryController.adjustQuantity (AdjustQuantityDto) л quantity-г
// хөндөнө. Энд lowStockThreshold болон override талбаруудыг л шууд
// update хийнэ.
export class UpdateInventoryItemDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  // `null` дамжуулж override-г арилгаж болно (эргэж variant-ийн анхны
  // утгыг ашиглах) тул @IsOptional() null/undefined аль алиныг нь алгасна.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  branchPrice?: number | null;

  @IsOptional()
  @IsBoolean()
  preOrderEnabledOverride?: boolean | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  preOrderLeadDaysOverride?: number | null;
}
