import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// §6.3 ADR spike-ыг бодитоор шалгах зориулалттай, түр зуурын endpoint.
// JwtAuthGuard бэлэн болмогц (Phase 1) энэ controller-ыг устгана эсвэл
// зөвхөн SUPER_ADMIN-д нээлттэй болгоно.
@Controller('debug')
export class DebugController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('branches')
  async branches() {
    return this.prisma.tx.branch.findMany();
  }
}
