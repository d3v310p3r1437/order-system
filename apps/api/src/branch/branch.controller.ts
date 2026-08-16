import { Controller, Get, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../common/roles.guard.js';
import { BranchService } from './branch.service.js';

// admin-web-ийн салбар сонгох dropdown (жиш: /products/:id-ийн inventory
// хэсэг) зорилготой минимал уншиж-л-болох endpoint — @Roles()-гүй тул
// зөвхөн нэвтэрсэн байхыг шаардана, RLS (branches_select) хэн ямар
// салбарыг харахыг бодитоор шийднэ. CUD энд ЗОРИУДАА алга (§7 "admin-web-ийн
// салбар удирдах хуудас" — CLAUDE.md-ийн "Дараагийн ажил" — энэ даалгаварт
// ХАМААРАХГҮЙ, тусад нь хийгдэнэ).
@Controller('branches')
@UseGuards(RolesGuard)
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Get()
  findAll() {
    return this.branchService.findAll();
  }
}
