import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class BranchService {
  constructor(private readonly prisma: PrismaService) {}

  // RLS (branches_select, 20260815082257_enable_rls_policies) нь
  // app_has_global_scope() эсвэл app_accessible_branch_ids()-д багтсан
  // мөрийг л шүүж буцаадаг тул энд нэмэлт WHERE шаардлагагүй.
  findAll() {
    return this.prisma.tx.branch.findMany({
      orderBy: { name: 'asc' },
    });
  }
}
