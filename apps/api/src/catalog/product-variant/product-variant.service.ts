import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  isForeignKeyViolation,
  isRecordNotFoundError,
  isUniqueConstraintViolation,
} from '../../common/prisma-errors.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateProductVariantDto } from './dto/create-product-variant.dto.js';
import type { UpdateProductVariantDto } from './dto/update-product-variant.dto.js';

const SKU_TAKEN = {
  code: 'PRODUCT_VARIANT_SKU_TAKEN',
  message: 'Энэ SKU өөр хувилбарт аль хэдийн ашиглагдсан байна',
};

@Injectable()
export class ProductVariantService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(productId?: string) {
    return this.prisma.tx.productVariant.findMany({
      where: productId === undefined ? {} : { productId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const variant = await this.prisma.tx.productVariant.findUnique({
      where: { id },
    });
    if (!variant) {
      throw new NotFoundException({
        code: 'PRODUCT_VARIANT_NOT_FOUND',
        message: 'Бүтээгдэхүүний хувилбар олдсонгүй',
      });
    }
    return variant;
  }

  async create(dto: CreateProductVariantDto) {
    try {
      return await this.prisma.tx.productVariant.create({
        data: {
          productId: dto.productId,
          name: dto.name,
          sku: dto.sku,
          unit: dto.unit,
          basePrice: dto.basePrice,
          costPrice: dto.costPrice,
          barcode: dto.barcode,
          isActive: dto.isActive,
          defaultPreOrderEnabled: dto.defaultPreOrderEnabled,
          defaultPreOrderLeadDays: dto.defaultPreOrderLeadDays,
          color: dto.color,
          size: dto.size,
          attributes: dto.attributes,
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException(SKU_TAKEN);
      }
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException({
          code: 'PRODUCT_NOT_FOUND',
          message: 'Заасан бүтээгдэхүүн олдсонгүй',
        });
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateProductVariantDto) {
    try {
      return await this.prisma.tx.productVariant.update({
        where: { id },
        data: {
          name: dto.name,
          sku: dto.sku,
          unit: dto.unit,
          basePrice: dto.basePrice,
          costPrice: dto.costPrice,
          barcode: dto.barcode,
          isActive: dto.isActive,
          defaultPreOrderEnabled: dto.defaultPreOrderEnabled,
          defaultPreOrderLeadDays: dto.defaultPreOrderLeadDays,
          color: dto.color,
          size: dto.size,
          attributes: dto.attributes,
        },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new NotFoundException({
          code: 'PRODUCT_VARIANT_NOT_FOUND',
          message: 'Бүтээгдэхүүний хувилбар олдсонгүй',
        });
      }
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException(SKU_TAKEN);
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.tx.productVariant.delete({ where: { id } });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new NotFoundException({
          code: 'PRODUCT_VARIANT_NOT_FOUND',
          message: 'Бүтээгдэхүүний хувилбар олдсонгүй',
        });
      }
      throw error;
    }
  }
}
