import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CheckoutOrderItemDto {
  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

// MVP чиглүүлэлт (docs/plan.md §8 Phase 3a): харилцагчийн шууд сонгосон
// branchId = захиалгын салбар шууд, geolocation-based auto-routing биш.
export class CheckoutOrderDto {
  @IsUUID()
  branchId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutOrderItemDto)
  items!: CheckoutOrderItemDto[];
}
