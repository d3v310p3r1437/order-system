import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  isRecordNotFoundError,
  isUniqueConstraintViolation,
} from '../../common/prisma-errors.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateCategoryDto } from './dto/create-category.dto.js';
import type { UpdateCategoryDto } from './dto/update-category.dto.js';

const SLUG_TAKEN = {
  code: 'CATEGORY_SLUG_TAKEN',
  message: 'Энэ slug өөр ангилалд аль хэдийн ашиглагдсан байна',
};

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(parentId?: string) {
    return this.prisma.tx.category.findMany({
      where: parentId === undefined ? {} : { parentId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.tx.category.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'Ангилал олдсонгүй',
      });
    }
    return category;
  }

  async create(dto: CreateCategoryDto) {
    try {
      return await this.prisma.tx.category.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          displayOrder: dto.displayOrder,
          isActive: dto.isActive,
          parentId: dto.parentId ?? null,
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException(SLUG_TAKEN);
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateCategoryDto) {
    try {
      return await this.prisma.tx.category.update({
        where: { id },
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          displayOrder: dto.displayOrder,
          isActive: dto.isActive,
          parentId: dto.parentId,
        },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new NotFoundException({
          code: 'CATEGORY_NOT_FOUND',
          message: 'Ангилал олдсонгүй',
        });
      }
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException(SLUG_TAKEN);
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.tx.category.delete({ where: { id } });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new NotFoundException({
          code: 'CATEGORY_NOT_FOUND',
          message: 'Ангилал олдсонгүй',
        });
      }
      throw error;
    }
  }
}
