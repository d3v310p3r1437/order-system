import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  isCheckConstraintViolation,
  isForeignKeyViolation,
  isRecordNotFoundError,
  isUniqueConstraintViolation,
} from '../common/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdjustQuantityDto } from './dto/adjust-quantity.dto.js';
import type { CreateInventoryItemDto } from './dto/create-inventory-item.dto.js';
import type { UpdateInventoryItemDto } from './dto/update-inventory-item.dto.js';

const NOT_FOUND = {
  code: 'INVENTORY_ITEM_NOT_FOUND',
  message: 'Нөөцийн мөр олдсонгүй',
};

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // RLS (inventory_items_select) нь app_can_manage_branch(branchId)-гүй
  // мөрийг өөрөө шүүж хасна — branchId/variantId filter нь зөвхөн
  // тодруулга, аюулгүй байдлын хамгаалалт биш.
  findAll(filter: { branchId?: string; variantId?: string }) {
    return this.prisma.tx.inventoryItem.findMany({
      where: {
        branchId: filter.branchId,
        variantId: filter.variantId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.tx.inventoryItem.findUnique({
      where: { id },
    });
    if (!item) {
      throw new NotFoundException(NOT_FOUND);
    }
    return item;
  }

  async create(dto: CreateInventoryItemDto) {
    try {
      return await this.prisma.tx.inventoryItem.create({
        data: {
          variantId: dto.variantId,
          branchId: dto.branchId,
          quantity: dto.quantity ?? 0,
          lowStockThreshold: dto.lowStockThreshold ?? 5,
          branchPrice: dto.branchPrice,
          preOrderEnabledOverride: dto.preOrderEnabledOverride,
          preOrderLeadDaysOverride: dto.preOrderLeadDaysOverride,
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException({
          code: 'INVENTORY_ITEM_ALREADY_EXISTS',
          message: 'Энэ хувилбар тухайн салбарт аль хэдийн бүртгэлтэй байна',
        });
      }
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException({
          code: 'VARIANT_OR_BRANCH_NOT_FOUND',
          message: 'Заасан хувилбар эсвэл салбар олдсонгүй',
        });
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateInventoryItemDto) {
    try {
      return await this.prisma.tx.inventoryItem.update({
        where: { id },
        data: {
          lowStockThreshold: dto.lowStockThreshold,
          branchPrice: dto.branchPrice,
          preOrderEnabledOverride: dto.preOrderEnabledOverride,
          preOrderLeadDaysOverride: dto.preOrderLeadDaysOverride,
        },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new NotFoundException(NOT_FOUND);
      }
      throw error;
    }
  }

  // "адаг тоогоор солих" биш "нэмэх/хасах" (delta) — read-then-write биш,
  // Prisma-гийн atomic `{ increment: delta }`-аар нэг query-д хийнэ (§7
  // модуль #4 даалгаврын шаардлага, race condition-оос сэргийлнэ).
  async adjustQuantity(id: string, dto: AdjustQuantityDto) {
    try {
      return await this.prisma.tx.inventoryItem.update({
        where: { id },
        data: { quantity: { increment: dto.delta } },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new NotFoundException(NOT_FOUND);
      }
      if (
        isCheckConstraintViolation(error, 'inventory_items_quantity_nonneg')
      ) {
        throw new ConflictException({
          code: 'INSUFFICIENT_STOCK',
          message: 'Нөөц хасах хэмжээнээс бага байна',
        });
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.tx.inventoryItem.delete({ where: { id } });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new NotFoundException(NOT_FOUND);
      }
      throw error;
    }
  }
}
