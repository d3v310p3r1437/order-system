import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  isForeignKeyViolation,
  isRecordNotFoundError,
} from '../../common/prisma-errors.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateProductDto } from './dto/create-product.dto.js';
import type { UpdateProductDto } from './dto/update-product.dto.js';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(categoryId?: string) {
    return this.prisma.tx.product.findMany({
      where: categoryId === undefined ? {} : { categoryId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
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
    return product;
  }

  async create(dto: CreateProductDto) {
    try {
      return await this.prisma.tx.product.create({
        data: {
          name: dto.name,
          description: dto.description,
          categoryId: dto.categoryId,
          isActive: dto.isActive,
        },
      });
    } catch (error) {
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
          description: dto.description,
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
