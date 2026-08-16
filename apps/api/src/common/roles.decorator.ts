import { SetMetadata } from '@nestjs/common';
import type { RoleName } from '@prisma/client';

export const ROLES_METADATA_KEY = 'roles:allowed';

// §6.1 матрицыг код болгох эхний алхам (CLAUDE.md "Дараагийн ажил").
// audit.decorator.ts-тэй ижил SetMetadata + Reflector загвар — endpoint
// бүрт тодорхой шаардлагатай дүрүүдийг зарлана. Metadata өгөгдөөгүй бол
// RolesGuard зөвхөн "нэвтэрсэн эсэх"-ийг шалгана (жиш: каталогийн SELECT).
export function Roles(...roles: RoleName[]): MethodDecorator {
  return SetMetadata<string, RoleName[]>(ROLES_METADATA_KEY, roles);
}
