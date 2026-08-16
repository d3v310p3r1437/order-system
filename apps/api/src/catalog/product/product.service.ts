import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ProductVariant } from '@prisma/client';
import {
  isForeignKeyViolation,
  isRecordNotFoundError,
  isUniqueConstraintViolation,
} from '../../common/prisma-errors.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  computeAvailabilityStatus,
  type AvailabilityResult,
} from '../inventory-effective.util.js';
import type { CreateProductDto } from './dto/create-product.dto.js';
import type { UpdateProductDto } from './dto/update-product.dto.js';

const SLUG_TAKEN = {
  code: 'PRODUCT_SLUG_TAKEN',
  message: 'Энэ slug өөр бүтээгдэхүүнд аль хэдийн ашиглагдсан байна',
};

// app_inventory_snapshot_for_variant() SQL функцийн буцаах мөр (§8 Phase 2,
// 20260816031625 migration) — quantity/override зөвхөн ЭНД, серверийн
// санах ойд л ашиглагдана, HTTP хариунд ХЭЗЭЭ Ч шууд сериалайзлагдахгүй.
interface InventorySnapshotRow {
  branchId: string;
  quantity: number;
  preOrderEnabledOverride: boolean | null;
  preOrderLeadDaysOverride: number | null;
}

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(categoryId?: string) {
    return this.prisma.tx.product.findMany({
      where: categoryId === undefined ? {} : { categoryId },
      orderBy: { name: 'asc' },
    });
  }

  // "Нийтэд харагдах" endpoint (docs/plan.md §8 Phase 2, 2-р хэсэг):
  // Product + бүх ProductVariant + тооцоолсон availability status-ийг
  // нэгтгэж буцаана. branchId өгөгдвөл тухайн салбарын, өгөгдөөгүй бол
  // бүх салбараар аггрегатласан ("аль нэг салбарт байвал IN_STOCK") утга.
  // InventoryItem-ийн бодит мөр (quantity, branchId-ийн жагсаалт) ХЭЗЭЭ Ч
  // хариунд гарахгүй — зөвхөн computeAvailabilityStatus()-ийн тооцоолсон
  // { status, leadDays } (CUSTOMER дүр ч аюулгүй дуудна, RLS-д мөргөлдөхгүй,
  // учир нь inventory_items хүснэгтийг шууд бус, зөвхөн SECURITY DEFINER
  // snapshot функцээр л уншина).
  async findOne(id: string, branchId?: string) {
    const product = await this.prisma.tx.product.findUnique({
      where: { id },
      include: { variants: true },
    });
    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Бүтээгдэхүүн олдсонгүй',
      });
    }

    const variants = await Promise.all(
      product.variants.map(async (variant) => ({
        ...variant,
        availability: await this.computeVariantAvailability(variant, branchId),
      })),
    );
    return { ...product, variants };
  }

  private async computeVariantAvailability(
    variant: ProductVariant,
    branchId: string | undefined,
  ): Promise<AvailabilityResult> {
    const rows = await this.prisma.tx.$queryRaw<InventorySnapshotRow[]>`
      SELECT * FROM app_inventory_snapshot_for_variant(${variant.id}, ${branchId ?? null})
    `;
    if (rows.length === 0) {
      return { status: 'OUT_OF_STOCK', leadDays: null };
    }

    const computed = rows.map((row) => computeAvailabilityStatus(row, variant));
    const inStock = computed.find((c) => c.status === 'IN_STOCK');
    if (inStock) {
      return inStock;
    }
    const preOrder = computed.find((c) => c.status === 'PRE_ORDER');
    if (preOrder) {
      return preOrder;
    }
    return { status: 'OUT_OF_STOCK', leadDays: null };
  }

  async create(dto: CreateProductDto) {
    try {
      return await this.prisma.tx.product.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          brand: dto.brand,
          categoryId: dto.categoryId,
          isActive: dto.isActive,
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException(SLUG_TAKEN);
      }
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException({
          code: 'CATEGORY_NOT_FOUND',
          message: 'Заасан ангилал олдсонгүй',
        });
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateProductDto) {
    try {
      return await this.prisma.tx.product.update({
        where: { id },
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          brand: dto.brand,
          categoryId: dto.categoryId,
          isActive: dto.isActive,
        },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new NotFoundException({
          code: 'PRODUCT_NOT_FOUND',
          message: 'Бүтээгдэхүүн олдсонгүй',
        });
      }
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException(SLUG_TAKEN);
      }
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException({
          code: 'CATEGORY_NOT_FOUND',
          message: 'Заасан ангилал олдсонгүй',
        });
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.tx.product.delete({ where: { id } });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new NotFoundException({
          code: 'PRODUCT_NOT_FOUND',
          message: 'Бүтээгдэхүүн олдсонгүй',
        });
      }
      throw error;
    }
  }
}
