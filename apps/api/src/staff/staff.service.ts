import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { RoleName } from '@prisma/client';
import { isUniqueConstraintViolation } from '../common/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { KeycloakAdminService } from './keycloak-admin.service.js';
import type { CreateStaffDto } from './dto/create-staff.dto.js';
import type { UpdateStaffDto } from './dto/update-staff.dto.js';

const GLOBAL_ROLES: RoleName[] = ['SUPER_ADMIN', 'OWNER', 'ALL_BRANCH_MANAGER'];

const STAFF_NOT_FOUND = {
  code: 'STAFF_NOT_FOUND',
  message: 'Ажилтан олдсонгүй',
};
const FORBIDDEN_STAFF_ACTION = {
  code: 'FORBIDDEN',
  message:
    'Энэ ажилтныг удирдах эрхгүй байна (зөвхөн SUPER_ADMIN/ALL_BRANCH_MANAGER эсвэл тухайн салбарын BRANCH_ADMIN)',
};
const EMAIL_TAKEN = {
  code: 'STAFF_EMAIL_TAKEN',
  message: 'Энэ и-мэйл хаяг Postgres-д аль хэдийн бүртгэлтэй байна',
};
const BRANCH_ID_REQUIRED = {
  code: 'BRANCH_ID_REQUIRED',
  message: 'Энэ дүрд салбар (branchId) заавал шаардлагатай',
};
const BRANCH_ID_NOT_ALLOWED = {
  code: 'BRANCH_ID_NOT_ALLOWED_FOR_GLOBAL_ROLE',
  message:
    'Глобал дүрд (SUPER_ADMIN/OWNER/ALL_BRANCH_MANAGER) branchId зааж болохгүй',
};
const ASSIGNMENT_NOT_FOUND = {
  code: 'STAFF_ASSIGNMENT_NOT_FOUND',
  message: 'Солих гэж буй одоогийн дүр/салбарын мөр олдсонгүй',
};

export interface StaffListItem {
  id: string;
  email: string | null;
  fullName: string | null;
  isActive: boolean;
  createdAt: Date;
  roles: {
    role: RoleName;
    branchId: string | null;
    branchName: string | null;
  }[];
}

export interface CreateStaffResult {
  id: string;
  email: string;
  fullName: string;
  role: RoleName;
  branchId: string | null;
  // ⚠️ ЗӨВХӨН энэ хариунд НЭГ Л УДАА буцна — Postgres/Keycloak аль алинд нь
  // хадгалагдахгүй (KeycloakAdminService.setPassword() коммент). Шинэ
  // ажилтанд аюулгүй сувгаар дамжуулж, анхны нэвтрэлтийн дараа Keycloak
  // admin console-оор өөрчлүүлэхийг зөвлөнө.
  temporaryPassword: string;
}

function assertValidRoleBranchPair(role: RoleName, branchId?: string): void {
  const isGlobal = GLOBAL_ROLES.includes(role);
  if (isGlobal && branchId) {
    throw new BadRequestException(BRANCH_ID_NOT_ALLOWED);
  }
  if (!isGlobal && !branchId) {
    throw new BadRequestException(BRANCH_ID_REQUIRED);
  }
}

// docs/adr/002-ийн "Инцидент (2026-08-25)"-ийг сэргээхгүй байх зорилготой:
// Keycloak (identity) + Postgres users/user_branch_roles (authorization)
// хоёрыг НЭГ атомик урсгал болгож нэгтгэнэ. Postgres тал (SQL функц)
// амжилтгүй болвол Keycloak-д ШИНЭЭР үүсгэсэн хэрэглэгчийг ROLLBACK
// (устгах)-аар цэвэрлэнэ — олдож ДАХИН АШИГЛАСАН хуучин Keycloak
// хэрэглэгчийг ХЭЗЭЭ Ч устгахгүй (тэр хэрэглэгч энэ дуудлагаас өмнө ч
// оршин байсан тул).
@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly keycloakAdmin: KeycloakAdminService,
  ) {}

  async findAll(filter: {
    role?: RoleName;
    branchId?: string;
  }): Promise<StaffListItem[]> {
    const users = await this.prisma.tx.user.findMany({
      where: {
        authProvider: 'KEYCLOAK',
        userBranchRoles:
          filter.role || filter.branchId
            ? { some: { role: filter.role, branchId: filter.branchId } }
            : undefined,
      },
      include: { userBranchRoles: { include: { branch: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      isActive: u.isActive,
      createdAt: u.createdAt,
      roles: u.userBranchRoles.map((r) => ({
        role: r.role,
        branchId: r.branchId,
        branchName: r.branch?.name ?? null,
      })),
    }));
  }

  async create(dto: CreateStaffDto): Promise<CreateStaffResult> {
    assertValidRoleBranchPair(dto.role, dto.branchId);

    const newUserId = randomUUID();
    const email = dto.email.trim().toLowerCase();

    // 1-р алхам: Keycloak тал (олдвол дахин ашиглана, эс бөгөөс шинээр
    // үүсгэнэ) — setup-realm.sh-ийн гар журмын 2-р алхам.
    const provisioned = await this.keycloakAdmin.provisionUser({
      email,
      fullName: dto.fullName,
      localUserId: newUserId,
    });

    // 2-р алхам: Postgres тал (users + user_branch_roles ХАМТ, ADR 005
    // WRITE ангилал) — setup-realm.sh-ийн гар журмын 1 БОЛОН 3-р алхам.
    let sqlResult: 'CREATED' | 'FORBIDDEN';
    try {
      const rows = await this.prisma.tx.$queryRaw<
        { app_create_staff_member: string }[]
      >`
        SELECT app_create_staff_member(${newUserId}, ${email}, ${dto.fullName}, ${dto.role}, ${dto.branchId ?? null})
      `;
      sqlResult = rows[0]?.app_create_staff_member as 'CREATED' | 'FORBIDDEN';
    } catch (error) {
      await this.rollbackKeycloakUser(
        provisioned.keycloakUserId,
        provisioned.wasCreated,
      );
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException(EMAIL_TAKEN);
      }
      throw error;
    }

    if (sqlResult !== 'CREATED') {
      await this.rollbackKeycloakUser(
        provisioned.keycloakUserId,
        provisioned.wasCreated,
      );
      throw new ForbiddenException(FORBIDDEN_STAFF_ACTION);
    }

    return {
      id: newUserId,
      email,
      fullName: dto.fullName,
      role: dto.role,
      branchId: dto.branchId ?? null,
      temporaryPassword: provisioned.temporaryPassword,
    };
  }

  async update(id: string, dto: UpdateStaffDto): Promise<{ id: string }> {
    if (dto.role) {
      assertValidRoleBranchPair(dto.role, dto.branchId);
    }

    const existing = await this.prisma.tx.user.findUnique({ where: { id } });
    if (!existing || existing.authProvider !== 'KEYCLOAK') {
      throw new NotFoundException(STAFF_NOT_FOUND);
    }

    const rows = await this.prisma.tx.$queryRaw<
      { app_update_staff_member: string }[]
    >`
      SELECT app_update_staff_member(
        ${id},
        ${dto.oldBranchId ?? null},
        ${dto.role ?? null},
        ${dto.branchId ?? null},
        ${dto.isActive ?? null}
      )
    `;
    const result = rows[0]?.app_update_staff_member;

    if (result === 'FORBIDDEN') {
      throw new ForbiddenException(FORBIDDEN_STAFF_ACTION);
    }
    if (result === 'ASSIGNMENT_NOT_FOUND') {
      throw new NotFoundException(ASSIGNMENT_NOT_FOUND);
    }
    return { id };
  }

  private async rollbackKeycloakUser(
    keycloakUserId: string,
    wasCreated: boolean,
  ): Promise<void> {
    if (!wasCreated) {
      return;
    }
    try {
      await this.keycloakAdmin.deleteUser(keycloakUserId);
    } catch (rollbackError) {
      // Rollback өөрөө амжилтгүй болвол "эзэнгүй" Keycloak хэрэглэгч
      // үлдэх эрсдэлтэй (local_user_id-той ч Postgres мөргүй — яг ЭНЭ
      // ажлын оношилсон инцидентийн шинж чанартай) тул ЗААВАЛ дуут
      // алдаагаар лог бичиж, админ гараар шалгах шаардлагатайг тэмдэглэнэ.
      this.logger.error(
        `Keycloak rollback амжилтгүй боллоо (keycloakUserId=${keycloakUserId}) — энэ хэрэглэгчийг Keycloak admin console-оор гараар шалгаж/устгах шаардлагатай`,
        rollbackError instanceof Error
          ? rollbackError.stack
          : String(rollbackError),
      );
    }
  }
}
