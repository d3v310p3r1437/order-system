import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  computeAvailabilityStatus,
  resolveEffectivePrice,
  type AvailabilityStatus,
} from '../catalog/inventory-effective.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { MinioService } from '../storage/minio.service.js';

// §7 модуль #5: сагс Postgres биш, Redis-д хадгалагдана (key:
// `cart:{userId}`, value: CartItemRecord[] JSON) — update бүрд TTL 30
// хоногоор сэргээгдэнэ (идэвхтэй хэрэглэгчийн сагс хэзээ ч дуусахгүй,
// орхигдсон сагс 30 хоногийн дараа автоматаар цэвэрлэгдэнэ).
const CART_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface CartItemRecord {
  variantId: string;
  quantity: number;
}

// app_inventory_snapshot_for_variant() SQL функц (20260816031625 /
// 20260816094500 migration) — order.service.ts-ийн resolveCheckoutItem()-тэй
// ЯГ ижил зарчим: CUSTOMER inventory_items-ийг шууд SELECT хийх эрхгүй
// (docs/adr/005) тул энэ SECURITY DEFINER "цонх" функцээр л branchPrice/
// quantity override уншина. Шинэ функц ЗОХИОГООГҮЙ — байгааг дахин ашиглав.
interface InventorySnapshotRow {
  branchId: string;
  quantity: number;
  branchPrice: Prisma.Decimal | string | number | null;
  preOrderEnabledOverride: boolean | null;
  preOrderLeadDaysOverride: number | null;
}

export type CartLineItem =
  | {
      variantId: string;
      quantity: number;
      unavailable: true;
    }
  | {
      variantId: string;
      quantity: number;
      unavailable: false;
      productId: string;
      productName: string;
      imageUrl: string | null;
      sku: string;
      unit: string;
      basePrice: Prisma.Decimal;
    };

export interface CartBranchValidationLine {
  variantId: string;
  quantity: number;
  productName: string | null;
  available: boolean;
  status: AvailabilityStatus;
  effectivePrice: Prisma.Decimal | null;
  leadDays: number | null;
}

export interface CartBranchValidationResult {
  items: CartBranchValidationLine[];
  totalAmount: Prisma.Decimal;
}

@Injectable()
export class CartService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {}

  private key(userId: string): string {
    return `cart:${userId}`;
  }

  private async readRaw(userId: string): Promise<CartItemRecord[]> {
    const raw = await this.redis.get(this.key(userId));
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as CartItemRecord[]) : [];
    } catch {
      // Redis-д гэмтсэн/танигдахгүй утга байвал сагс хоосон гэж үзнэ —
      // алдаа шидэхгүй (хэрэглэгчийн туршлагад "сагс дахин цэвэрлэгдсэн"
      // гэсэн мэдрэмж, устгагдсан датаг сэргээхийг оролдохгүй).
      return [];
    }
  }

  private async writeRaw(
    userId: string,
    items: CartItemRecord[],
  ): Promise<void> {
    await this.redis.set(
      this.key(userId),
      JSON.stringify(items),
      'EX',
      CART_TTL_SECONDS,
    );
  }

  // variantId аль хэдийн сагсанд байвал quantity-г ШИНЭ утгаар солино
  // (delta нэмэхгүй, "upsert-set" семантик) — Flutter CartScreen-ийн +/-
  // adjuster шинэ (бодит) тоо хэмжээг өөрөө тооцоод дамжуулна, серверийн
  // талд "хэдээр нэмэх үү" гэсэн хоёрдмол утгагүй байлгахын тулд.
  async addOrUpdateItem(
    userId: string,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    const items = await this.readRaw(userId);
    const existing = items.find((item) => item.variantId === variantId);
    if (existing) {
      existing.quantity = quantity;
    } else {
      items.push({ variantId, quantity });
    }
    await this.writeRaw(userId, items);
  }

  async removeItem(userId: string, variantId: string): Promise<void> {
    const items = await this.readRaw(userId);
    const next = items.filter((item) => item.variantId !== variantId);
    if (next.length === 0) {
      await this.redis.del(this.key(userId));
      return;
    }
    await this.writeRaw(userId, next);
  }

  async clear(userId: string): Promise<void> {
    await this.redis.del(this.key(userId));
  }

  // OrderService.checkout()-ийн цорын ганц эх сурвалж — захиалгын item-үүд
  // ХЭЗЭЭ Ч клиентийн HTTP body-оос шууд ирэхгүй, зөвхөн энд (аль хэдийн
  // сервэр талд бичигдсэн) Redis сагснаас л уншигдана.
  async listForCheckout(userId: string): Promise<CartItemRecord[]> {
    return this.readRaw(userId);
  }

  // Redis-ийн variantId+quantity-г Postgres-ээс уншсан бүтээгдэхүүний
  // нэр/зураг/variant.basePrice-тай нэгтгэнэ. Устсан/idle variant (эсвэл
  // эцэг Product idle) байвал алдаа шидэхгүй, зөвхөн `unavailable: true`
  // тэмдэглэж quantity-г л (бусад талбаргүйгээр) буцаана — сагсны мөр
  // хэвээр харагдана, гэхдээ захиалах боломжгүй гэдэг нь тодорхой.
  async getCart(userId: string): Promise<CartLineItem[]> {
    const items = await this.readRaw(userId);
    if (items.length === 0) {
      return [];
    }

    const variantIds = items.map((item) => item.variantId);
    const variants = await this.prisma.tx.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: {
        product: {
          include: {
            images: { orderBy: { displayOrder: 'asc' }, take: 1 },
          },
        },
      },
    });
    const byId = new Map(variants.map((variant) => [variant.id, variant]));

    return items.map((item) => {
      const variant = byId.get(item.variantId);
      if (!variant || !variant.isActive || !variant.product.isActive) {
        return {
          variantId: item.variantId,
          quantity: item.quantity,
          unavailable: true,
        };
      }
      const image = variant.product.images[0];
      return {
        variantId: item.variantId,
        quantity: item.quantity,
        unavailable: false,
        productId: variant.product.id,
        productName: variant.product.name,
        imageUrl: image ? this.minio.getPublicUrl(image.objectKey) : null,
        sku: variant.sku,
        unit: variant.unit,
        basePrice: variant.basePrice,
      };
    });
  }

  // Checkout-ийн салбар сонголтын өмнөх урьдчилсан харагдац: одоогийн
  // сагсны variant бүрийг тухайн branchId-д computeAvailabilityStatus()/
  // resolveEffectivePrice()-аар (order.service.ts-ийн resolveCheckoutItem()-тэй
  // ижил эх сурвалж, ганц газар л шийднэ) шалгаж, нийт дүнг ЗӨВХӨН бэлэн
  // (OUT_OF_STOCK биш) зүйлсээр тооцно.
  async validateBranch(
    userId: string,
    branchId: string,
  ): Promise<CartBranchValidationResult> {
    const items = await this.readRaw(userId);
    if (items.length === 0) {
      return { items: [], totalAmount: new Prisma.Decimal(0) };
    }

    const variantIds = items.map((item) => item.variantId);
    const variants = await this.prisma.tx.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true },
    });
    const byId = new Map(variants.map((variant) => [variant.id, variant]));

    const lines: CartBranchValidationLine[] = [];
    let totalAmount = new Prisma.Decimal(0);

    for (const item of items) {
      const variant = byId.get(item.variantId);
      if (!variant || !variant.isActive || !variant.product.isActive) {
        lines.push({
          variantId: item.variantId,
          quantity: item.quantity,
          productName: variant?.product.name ?? null,
          available: false,
          status: 'OUT_OF_STOCK',
          effectivePrice: null,
          leadDays: null,
        });
        continue;
      }

      const rows = await this.prisma.tx.$queryRaw<InventorySnapshotRow[]>`
        SELECT * FROM app_inventory_snapshot_for_variant(${item.variantId}, ${branchId})
      `;
      const snapshot = rows[0] ?? null;
      const branchPrice =
        snapshot?.branchPrice != null
          ? new Prisma.Decimal(snapshot.branchPrice)
          : null;
      const availability = computeAvailabilityStatus(snapshot, variant);
      const available = availability.status !== 'OUT_OF_STOCK';
      const effectivePrice = available
        ? resolveEffectivePrice(
            { branchPrice },
            { basePrice: variant.basePrice },
          )
        : null;

      if (available && effectivePrice) {
        totalAmount = totalAmount.add(effectivePrice.mul(item.quantity));
      }

      lines.push({
        variantId: item.variantId,
        quantity: item.quantity,
        productName: variant.product.name,
        available,
        status: availability.status,
        effectivePrice,
        leadDays: availability.leadDays,
      });
    }

    return { items: lines, totalAmount };
  }
}
