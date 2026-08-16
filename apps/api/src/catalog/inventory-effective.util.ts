import type { InventoryItem, ProductVariant } from '@prisma/client';

// docs/plan.md §8 Phase 2 (2-р хэсэг): салбарын InventoryItem дээрх
// override нь ProductVariant-ийн анхны утгыг дарж бичдэг. Энэ логикийг
// ГАНЦ л газар бичиж (davhardуулахгүй), staff-ийн шууд InventoryItem
// унших зам (RLS-ээр зөвшөөрөгдсөн) БОЛОН харилцагчид зориулсан "нийтэд
// харагдах" endpoint (RLS-ийг app_inventory_snapshot_for_variant()
// SECURITY DEFINER функцээр тойрсон, зөвхөн ижил хэлбэрийн түүхий
// баганатай snapshot мөрийг дамжуулдаг) хоёулаа ашиглана.

export type AvailabilityStatus = 'IN_STOCK' | 'PRE_ORDER' | 'OUT_OF_STOCK';

export interface EffectivePreOrder {
  enabled: boolean;
  leadDays: number | null;
}

export interface AvailabilityResult {
  status: AvailabilityStatus;
  leadDays: number | null;
}

type PriceOverrideSource = Pick<InventoryItem, 'branchPrice'>;
type PriceBaseSource = Pick<ProductVariant, 'basePrice'>;

type PreOrderOverrideSource = Pick<
  InventoryItem,
  'preOrderEnabledOverride' | 'preOrderLeadDaysOverride'
>;
type PreOrderDefaultSource = Pick<
  ProductVariant,
  'defaultPreOrderEnabled' | 'defaultPreOrderLeadDays'
>;

type StockSource = Pick<InventoryItem, 'quantity'>;

export function resolveEffectivePrice(
  item: PriceOverrideSource,
  variant: PriceBaseSource,
): PriceBaseSource['basePrice'] {
  return item.branchPrice ?? variant.basePrice;
}

export function resolveEffectivePreOrder(
  item: PreOrderOverrideSource,
  variant: PreOrderDefaultSource,
): EffectivePreOrder {
  return {
    enabled: item.preOrderEnabledOverride ?? variant.defaultPreOrderEnabled,
    leadDays: item.preOrderLeadDaysOverride ?? variant.defaultPreOrderLeadDays,
  };
}

// `item` нь null/undefined байж болно — тухайн салбарт энэ variant-ийн
// InventoryItem мөр огт үүсээгүй (жиш: салбар энэ бараа огт захиалж
// байгаагүй) тохиолдлыг илэрхийлнэ. Callee (ProductService) rows.length
// === 0-г тусад нь шалгаж OUT_OF_STOCK буцаах шаардлагагүй болгохын тулд
// "мөр байхгүй" гэдгийг ЭНД, ганц газар л шийднэ — эс бөгөөс ижил
// шийдвэр хоёр газар (util + дуудагч) давхардаж бичигдэх эрсдэлтэй.
export function computeAvailabilityStatus(
  item: (StockSource & PreOrderOverrideSource) | null | undefined,
  variant: PreOrderDefaultSource,
): AvailabilityResult {
  if (!item) {
    return { status: 'OUT_OF_STOCK', leadDays: null };
  }
  if (item.quantity > 0) {
    return { status: 'IN_STOCK', leadDays: null };
  }
  const effective = resolveEffectivePreOrder(item, variant);
  if (effective.enabled) {
    return { status: 'PRE_ORDER', leadDays: effective.leadDays };
  }
  return { status: 'OUT_OF_STOCK', leadDays: null };
}
