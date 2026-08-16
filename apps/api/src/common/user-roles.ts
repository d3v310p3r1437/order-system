import type { Prisma } from '@prisma/client';

// auth/auth.controller.ts-ийн GET /auth/me-тэй ижил логик (user_branch_roles
// мөргүй бол authProvider=CUSTOMER_AUTH эсэхээр CUSTOMER гэж дүгнэнэ) —
// зөвхөн RolesGuard-ын шалгалтад хэрэгтэй "дүрийн нэрсийн жагсаалт"
// хэлбэрээр буцаана (branchId-г заавал шаардахгүй тул тусад нь бичив).
export async function resolveUserRoleNames(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<string[]> {
  const ubrRows = await tx.userBranchRole.findMany({ where: { userId } });
  if (ubrRows.length > 0) {
    return [...new Set(ubrRows.map((r) => r.role))];
  }

  const user = await tx.user.findUnique({ where: { id: userId } });
  if (user?.authProvider === 'CUSTOMER_AUTH') {
    return ['CUSTOMER'];
  }
  return [];
}
