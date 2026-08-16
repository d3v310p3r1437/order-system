import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/roles.guard.js';
import { BranchController } from './branch.controller.js';
import { BranchService } from './branch.service.js';

// docs/plan.md §7 модуль #2 (Салбарын удирдлага) — одоохондоо зөвхөн уншихад
// зориулсан минимал хэсэг (admin-web-ийн салбар сонгох dropdown-д хэрэгтэй).
// Бүрэн CRUD (салбар удирдах хуудас) CLAUDE.md-ийн "Дараагийн ажил" хэсэгт
// орсон, ирээдүйд тусад нь хэрэгжинэ.
@Module({
  controllers: [BranchController],
  providers: [BranchService, RolesGuard],
})
export class BranchModule {}
