import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import type { RoleName } from '@prisma/client';

const STAFF_ROLES: RoleName[] = [
  'SUPER_ADMIN',
  'OWNER',
  'ALL_BRANCH_MANAGER',
  'BRANCH_ADMIN',
  'BRANCH_MANAGER',
  'SALESPERSON',
];

// role/branchId хосыг дахин оноохдоо ХОЁУЛАНГ нь ХАМТ дамжуулна (зөвхөн
// нэгийг нь өөрчлөх боломжгүй — StaffService.update()-д шалгана).
// oldBranchId нь ОДООГИЙН (солих гэж буй) assignment-ыг заана — staff
// жагсаалтын мөр бүр ганц (role, branchId) хостой (Create endpoint ч
// нэг мөрийг л үүсгэдэг тул) гэсэн зарчимд тулгуурлав.
export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  oldBranchId?: string;

  @IsOptional()
  @IsIn(STAFF_ROLES)
  role?: RoleName;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
