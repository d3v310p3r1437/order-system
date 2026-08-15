import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import { RequestContextService } from '../common/request-context.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface MeRole {
  role: string;
  branchId: string | null;
}

// §6.2 жишээ: role/branch-аа frontend хэрхэн мэдэх вэ гэдгийг харуулна —
// JWT-ээс биш, зөвхөн user_branch_roles хүснэгтээс (RLS-ээр аль хэдийн
// хамгаалагдсан) уншина.
@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get('me')
  async me(): Promise<{ userId: string; roles: MeRole[] }> {
    const { userId } = this.requestContext.get();
    if (!userId) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Нэвтрээгүй байна',
      });
    }

    const ubrRows = await this.prisma.tx.userBranchRole.findMany({
      where: { userId },
    });
    let roles: MeRole[] = ubrRows.map((r) => ({
      role: r.role,
      branchId: r.branchId,
    }));

    // Харилцагч (CUSTOMER_AUTH) бүр user_branch_roles-д мөр авдаггүй
    // (§6.1 матриц дахь "Харилцагч" бол branch-scoped удирдлагын эрх биш) —
    // тиймээс мөр олдоогүй ч authProvider-аар нь CUSTOMER гэдгийг тодруулна.
    if (roles.length === 0) {
      const user = await this.prisma.tx.user.findUnique({
        where: { id: userId },
      });
      if (user?.authProvider === 'CUSTOMER_AUTH') {
        roles = [{ role: 'CUSTOMER', branchId: null }];
      }
    }

    return { userId, roles };
  }
}
