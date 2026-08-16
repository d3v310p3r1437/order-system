import { Injectable, NotFoundException } from '@nestjs/common';
import { isRecordNotFoundError } from '../../common/prisma-errors.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateCategoryDto } from './dto/create-category.dto.js';
import type { UpdateCategoryDto } from './dto/update-category.dto.js';

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

  create(dto: CreateCategoryDto) {
    return this.prisma.tx.category.create({
      data: { name: dto.name, parentId: dto.parentId ?? null },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    try {
      return await this.prisma.tx.category.update({
        where: { id },
        data: { name: dto.name, parentId: dto.parentId },
      });
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
