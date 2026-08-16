import { IsInt, IsOptional, Min } from 'class-validator';

// Санамж: `quantity` энд ЗОРИУДАА байхгүй — "адаг тоогоор солих" биш
// "нэмэх/хасах" (delta) байдлаар л өөрчлөгдөх ёстой тул зөвхөн
// InventoryController.adjustQuantity (AdjustQuantityDto) л quantity-г
// хөндөнө. Энд lowStockThreshold мэт бусад талбарыг л шууд update хийнэ.
export class UpdateInventoryItemDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;
}
