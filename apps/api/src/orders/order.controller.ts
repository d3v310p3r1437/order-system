import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { OrderStatus } from '@prisma/client';
import { Audit } from '../common/audit.decorator.js';
import { RequestContextService } from '../common/request-context.js';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { CheckoutOrderDto } from './dto/checkout-order.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { OrderService } from './order.service.js';

// §6.1 матриц "Захиалга" мөр: staff (SUPER_ADMIN/ALL_BRANCH_MANAGER/
// BRANCH_ADMIN/BRANCH_MANAGER/SALESPERSON) + CUSTOMER-ийн статус
// шинэчлэлт (cancel) нэг endpoint-д нэгтгэсэн — OrderService.updateStatus()
// role-оос хамааран шилжилтийн дүрмийг ялгаж шалгана. OWNER-д зөвхөн R
// (бүх) байдаг тул орохгүй.
const STATUS_UPDATE_ROLES = [
  'SUPER_ADMIN',
  'ALL_BRANCH_MANAGER',
  'BRANCH_ADMIN',
  'BRANCH_MANAGER',
  'SALESPERSON',
  'CUSTOMER',
] as const;

// docs/plan.md §8 Phase 4, Хэсэг A #5-д анх staff-аар хязгаарласан байсан
// ("харилцагчийн харах шаардлага тодорхой заагаагүй" гэсэн тэмдэглэл).
// ⚠️ (2026-08-20, Cart→Checkout→QPay) Mobile-ийн OrderTrackingScreen
// DELIVERY захиалгад admin-web-ийн DeliveryRouteMap-тай ижил зам зурах
// шаардлагатай болсон тул CUSTOMER-ийг нэмэв — аюулгүй, учир нь
// OrderService.getRoute()→findOne() нь orders_select RLS-ээр л шүүгддэг
// (CUSTOMER зөвхөн ӨӨРИЙН захиалгаа харна, order.controller.ts-ийн
// findOne()-той ижил зарчим), @Roles() зөвхөн "аль дүрд ЕРӨНХИЙД нь
// зөвшөөрөгдсөн бэ" гэдгийг шалгадаг тул мөр-түвшний хамгаалалт хэвээр.
const ROUTE_VIEW_ROLES = [
  'SUPER_ADMIN',
  'ALL_BRANCH_MANAGER',
  'BRANCH_ADMIN',
  'BRANCH_MANAGER',
  'SALESPERSON',
  'CUSTOMER',
] as const;

@Controller('orders')
@UseGuards(RolesGuard)
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly requestContext: RequestContextService,
  ) {}

  // §6.1 матрицын дагуу RLS (orders_select) өөрөө үзэгдэх мөрийг шүүнэ
  // (CUSTOMER зөвхөн өөрийнхөө захиалга) — @Roles()-гүй тул зөвхөн
  // нэвтэрсэн байхыг шаардана.
  @Get()
  findAll(
    @Query('status') status?: OrderStatus,
    @Query('branchId') branchId?: string,
  ) {
    return this.orderService.findAll({ status, branchId });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orderService.findOne(id);
  }

  // docs/plan.md §8 Phase 4, Хэсэг A #5: зөвхөн унших тул @Audit()
  // шаардлагагүй (мутаци биш).
  @Get(':id/route')
  @Roles(...ROUTE_VIEW_ROLES)
  getRoute(@Param('id') id: string) {
    return this.orderService.getRoute(id);
  }

  // Checkout нь ЗӨВХӨН CUSTOMER-ийн өөрийнх нь нэрийн өмнөөс хийгддэг
  // (docs/plan.md §8 Phase 3a-ийн Body хэлбэр customerId авдаггүй) — staff
  // харилцагчийн нэрийн өмнөөс захиалга үүсгэх нь энэ Phase-ийн хамрах
  // хүрээнээс гадуур (тодорхой шаардлагагүй тул нэмээгүй).
  @Post()
  @Roles('CUSTOMER')
  @Audit('orders')
  checkout(@Body() dto: CheckoutOrderDto) {
    const { userId } = this.requestContext.get();
    if (!userId) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Нэвтрээгүй байна',
      });
    }
    return this.orderService.checkout(userId, dto);
  }

  @Patch(':id/status')
  @Roles(...STATUS_UPDATE_ROLES)
  @Audit('orders', { action: 'orders.status_changed' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    const { userId } = this.requestContext.get();
    if (!userId) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Нэвтрээгүй байна',
      });
    }
    return this.orderService.updateStatus(id, userId, dto);
  }
}
