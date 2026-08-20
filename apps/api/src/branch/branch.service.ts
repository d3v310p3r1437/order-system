import { Injectable } from '@nestjs/common';
import { RequestContextService } from '../common/request-context.js';
import { resolveUserRoleNames } from '../common/user-roles.js';
import { PrismaService } from '../prisma/prisma.service.js';

// app_public_branches() SQL функцийн буцаах мөр (20260820120000
// migration) — зөвхөн нийтэд аюулгүй баганууд.
export interface PublicBranchRow {
  id: string;
  name: string;
  address: string | null;
  district: string | null;
}

@Injectable()
export class BranchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  // `branches_select` RLS (`app_accessible_branch_ids()`) нь ЗӨВХӨН
  // `user_branch_roles` мөртэй хэрэглэгчид (staff) зориулагдсан тул
  // CUSTOMER-д (эдгээр хэзээ ч мөргүй) энэ query үргэлж ХООСОН буцаана —
  // Android emulator дээр BranchSelectionScreen "Салбар олдсонгүй" гэж
  // харуулснаар олдсон бодит алдаа. CUSTOMER-ийн хувьд ADR 005-ийн
  // "READ-redact" зарчмаар (app_inventory_snapshot_for_variant()-тэй
  // адилхан) зөвхөн идэвхтэй салбаруудын нийтэд аюулгүй баганыг
  // SECURITY DEFINER функцээр уншина; staff (admin-web-ийн inventory
  // dropdown) хэвээр RLS-ээр өөрийн харах эрхтэй бүх салбараа авна.
  async findAll() {
    const { userId } = this.requestContext.get();
    const roles = userId
      ? await resolveUserRoleNames(this.prisma.tx, userId)
      : [];

    if (roles.includes('CUSTOMER')) {
      return this.prisma.tx.$queryRaw<PublicBranchRow[]>`
        SELECT * FROM app_public_branches()
      `;
    }

    return this.prisma.tx.branch.findMany({
      orderBy: { name: 'asc' },
    });
  }
}
