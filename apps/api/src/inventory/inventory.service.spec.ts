import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InventoryService } from './inventory.service.js';

function knownRequestError(
  code: string,
  meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('mock prisma error', {
    code,
    clientVersion: '6.19.3',
    meta,
  });
}

function unknownRequestError(
  message: string,
): Prisma.PrismaClientUnknownRequestError {
  return new Prisma.PrismaClientUnknownRequestError(message, {
    clientVersion: '6.19.3',
  });
}

describe('InventoryService', () => {
  let update: jest.Mock;
  let create: jest.Mock;
  let service: InventoryService;

  beforeEach(() => {
    update = jest.fn();
    create = jest.fn();
    const prisma = {
      get tx() {
        return { inventoryItem: { update, create } };
      },
    };
    service = new InventoryService(
      prisma as unknown as ConstructorParameters<typeof InventoryService>[0],
    );
  });

  describe('adjustQuantity', () => {
    it('quantity-г шууд солихгүй, atomic { increment: delta } ашиглана', async () => {
      update.mockResolvedValue({ id: 'item-1', quantity: 8 });
      await service.adjustQuantity('item-1', { delta: -2 });
      expect(update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { quantity: { increment: -2 } },
      });
    });

    it('мөр олдоогүй (P2025) бол NotFoundException болгоно', async () => {
      update.mockRejectedValue(knownRequestError('P2025'));
      await expect(
        service.adjustQuantity('missing', { delta: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('quantity сөрөг рүү орох CHECK constraint зөрчил (23514) бол 409 INSUFFICIENT_STOCK', async () => {
      update.mockRejectedValue(
        unknownRequestError(
          'Error occurred during query execution: ConnectorError(... PostgresError { code: "23514", message: "new row for relation \\"inventory_items\\" violates check constraint \\"inventory_items_quantity_nonneg\\"" ...})',
        ),
      );
      await expect(
        service.adjustQuantity('item-1', { delta: -100 }),
      ).rejects.toThrow(ConflictException);
    });

    it('холбоогүй бусад алдааг өөрчлөлгүй дахин шидэнэ', async () => {
      update.mockRejectedValue(new Error('unexpected'));
      await expect(
        service.adjustQuantity('item-1', { delta: 1 }),
      ).rejects.toThrow('unexpected');
    });
  });

  describe('create', () => {
    it('давхардсан (variantId, branchId) хос (P2002) бол 409 INVENTORY_ITEM_ALREADY_EXISTS', async () => {
      create.mockRejectedValue(knownRequestError('P2002'));
      await expect(
        service.create({ variantId: 'v-1', branchId: 'b-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('variantId/branchId олдохгүй бол (P2003) 400 VARIANT_OR_BRANCH_NOT_FOUND', async () => {
      create.mockRejectedValue(knownRequestError('P2003'));
      await expect(
        service.create({ variantId: 'v-1', branchId: 'b-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('quantity өгөгдөөгүй бол 0, lowStockThreshold өгөгдөөгүй бол 5-аар анхны утга тавина', async () => {
      create.mockResolvedValue({ id: 'item-1' });
      await service.create({ variantId: 'v-1', branchId: 'b-1' });
      expect(create).toHaveBeenCalledWith({
        data: {
          variantId: 'v-1',
          branchId: 'b-1',
          quantity: 0,
          lowStockThreshold: 5,
          branchPrice: undefined,
          preOrderEnabledOverride: undefined,
          preOrderLeadDaysOverride: undefined,
        },
      });
    });
  });
});
