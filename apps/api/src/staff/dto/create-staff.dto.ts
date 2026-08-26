import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { RoleName } from '@prisma/client';

// CUSTOMER-ийг ЗОРИУДАА хассан — энэ endpoint зөвхөн АЖИЛТНЫ (Keycloak-ээр
// нэвтэрдэг) дүрд зориулагдсан, харилцагч ADR 002-ийн дагуу өөрөө
// бүртгүүлдэг (src/auth-customer).
const STAFF_ROLES: RoleName[] = [
  'SUPER_ADMIN',
  'OWNER',
  'ALL_BRANCH_MANAGER',
  'BRANCH_ADMIN',
  'BRANCH_MANAGER',
  'SALESPERSON',
];

// role/branchId-ийн уялдааг (глобал role → branchId ХОРИОТОЙ, салбарын
// role → branchId ЗААВАЛ) энд DTO decorator-оор БИШ, StaffService дотор
// шалгана (checkout-order.dto.ts-ийн IsDeliveryField шиг тусгай
// cross-field validator зохиох нь энэ endpoint-ийн цар хүрээнд илүүц гэж
// үзсэн — жинхэнэ аюулгүй байдлын хамгаалалт аль хэдийн
// app_create_staff_member() SQL функц дотор бие даан хийгддэг, DTO/
// service талын шалгалт зөвхөн ойлгомжтой алдааны мессеж өгөх зорилготой).
export class CreateStaffDto {
  @IsString()
  @MaxLength(200)
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  fullName!: string;

  @IsIn(STAFF_ROLES)
  role!: RoleName;

  @IsOptional()
  @IsString()
  branchId?: string;
}
