import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RoleName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequestContextService } from './request-context.js';
import { ROLES_METADATA_KEY } from './roles.decorator.js';
import { resolveUserRoleNames } from './user-roles.js';

// §6.1 матрицыг код болгосон endpoint-түвшний RBAC guard. RLS (§6.3) нь
// мөр-түвшний (жиш: аль салбарын inventory харагдах) сүүлчийн хамгаалалт
// хэвээр үлдэнэ — энэ guard зөвхөн "энэ endpoint-ыг ЕРӨНХИЙД нь дуудах
// эрхтэй эсэх"-ийг @Roles()-оор тэмдэглэсэн дүрсийн жагсаалттай тулгаж
// шалгана, шинэ authorization архитектур зохиогоогүй — одоо байгаа
// audit.decorator.ts/AuditInterceptor-той ижил SetMetadata+Reflector
// pattern-ийг л ашиглав.
//
// ⚠️⚠️ ЧУХАЛ (staff.module.ts зохиох явцад олдсон): `resolveUserRoleNames()`
// (user-roles.ts) `user_branch_roles.role`-ийг ЗӨВХӨН НЭРЭЭР нь буцаадаг,
// `branchId`-тай ХАМТ шалгадаггүй. Өөрөөр хэлбэл `@Roles('SUPER_ADMIN')`
// гэдэг нь бодит `app_has_global_scope()`-ийн адил "branchId IS NULL"
// гэдгийг ШАЛГАДАГГҮЙ — branchId-той (жиш: нэг салбарт "хавсарсан")
// SUPER_ADMIN-ийн нэртэй мөртэй хэрэглэгч ч энэ guard-ыг АМЖИЛТТАЙ
// давна (харин `app_has_global_scope()`-д тулгуурласан RLS/SECURITY
// DEFINER функцүүд зөв татгалзана). Ийм мөр өөрөө SQL-ээр шууд бичихээс
// өөр аргаар үүсэхгүй байсан тул өнөөг хүртэл асуудал үзүүлээгүй, гэвч
// хэрэв ирээдүйд шинэ endpoint (staff CRUD шиг) хэрэглэгчийн role/
// branchId-г чөлөөтэй бичих боломж олговол, ЗААВАЛ (1) branch-scoped
// дуудагчийг глобал нэртэй role (SUPER_ADMIN/OWNER/ALL_BRANCH_MANAGER)
// оноохоос хориглох, эсвэл (2) мутацийг ЗӨВХӨН SECURITY DEFINER функц
// дотор app_has_global_scope()-оор ДАХИН шалгах ёстой (staff/
// staff.service.ts + migration 20260825090000-ийн
// app_create_staff_member()-ийн жишээг үз) — @Roles() ганцаараа хангалтгүй.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { userId } = this.requestContext.get();
    if (!userId) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Нэвтрээгүй байна',
      });
    }

    const requiredRoles = this.reflector.get<RoleName[] | undefined>(
      ROLES_METADATA_KEY,
      context.getHandler(),
    );
    // @Roles()-гүй endpoint (жиш: каталогийн GET) — зөвхөн нэвтэрсэн байхыг
    // шаардана, §6.1-ийн "бүх нэвтэрсэн хэрэглэгчид" эрхтэй тохирно.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const userRoles = await resolveUserRoleNames(this.prisma.tx, userId);
    const allowed = requiredRoles.some((role) => userRoles.includes(role));
    if (!allowed) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Энэ үйлдэл хийх эрхгүй байна',
      });
    }
    return true;
  }
}
