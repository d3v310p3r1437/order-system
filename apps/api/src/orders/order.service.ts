import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type OrderStatus, type RoleName } from '@prisma/client';
import { resolveEffectivePrice } from '../catalog/inventory-effective.util.js';
import {
  isCheckConstraintViolation,
  isForeignKeyViolation,
} from '../common/prisma-errors.js';
import { resolveUserRoleNames } from '../common/user-roles.js';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from '../payment/payment-provider.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrderEventsPublisher } from '../realtime/order-events.publisher.js';
import type {
  CheckoutOrderDto,
  CheckoutOrderItemDto,
} from './dto/checkout-order.dto.js';
import type { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import {
  isOrderTransitionAllowed,
  isRestockingTransition,
} from './order-state-machine.js';

const ORDER_NOT_FOUND = {
  code: 'ORDER_NOT_FOUND',
  message: 'Захиалга олдсонгүй',
};
const OUT_OF_STOCK = {
  code: 'OUT_OF_STOCK',
  message: 'Захиалсан бараа нөөцөд хүрэлцэхгүй байна',
};
const INVALID_TRANSITION = {
  code: 'INVALID_ORDER_STATUS_TRANSITION',
  message: 'Захиалгын энэ төлөвийн шилжилт зөвшөөрөгдөөгүй байна',
};

// PATCH /orders/:id/status-ыг дуудаж болох "staff" дүрс (§6.1 матриц:
// OWNER-д зөвхөн R байдаг тул орохгүй). Эдгээрээс өөр (зөвхөн CUSTOMER)
// дүртэй хүсэлтийг OrderService.updateStatus() cancel-only дүрмээр шалгана.
const STAFF_STATUS_ROLES: RoleName[] = [
  'SUPER_ADMIN',
  'ALL_BRANCH_MANAGER',
  'BRANCH_ADMIN',
  'BRANCH_MANAGER',
  'SALESPERSON',
];

// app_inventory_snapshot_for_variant() SQL функцийн буцаах мөр
// (20260816094500_extend_inventory_snapshot_with_price migration-оор
// branchPrice баганатай болов) — quantity/override-той адил зөвхөн
// серверийн санах ойд л ашиглагдана.
interface InventorySnapshotRow {
  branchId: string;
  quantity: number;
  branchPrice: Prisma.Decimal | string | number | null;
  preOrderEnabledOverride: boolean | null;
  preOrderLeadDaysOverride: number | null;
}

interface ResolvedCheckoutItem {
  variantId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
}

// docs/plan.md §7 модуль #5, #6; §8 Phase 3a.
@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
    private readonly orderEvents: OrderEventsPublisher,
  ) {}

  findAll(filter: { status?: OrderStatus; branchId?: string }) {
    // RLS (orders_select) нь дүрд харагдахгүй мөрийг өөрөө шүүж хасна —
    // энд дамжуулсан filter зөвхөн тодруулга.
    return this.prisma.tx.order.findMany({
      where: { status: filter.status, branchId: filter.branchId },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.tx.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException(ORDER_NOT_FOUND);
    }
    return order;
  }

  // Checkout: Order + OrderItem-үүдийг үүсгээд InventoryItem.quantity-г
  // ATOMIC decrement хийнэ (§7 модуль #5). RlsMiddleware хэдийн бүх
  // хүсэлтийг нэг interactive transaction-д ороосон байдаг (docs/adr/001)
  // тул энд `prisma.$transaction`-ыг ДАХИН дуудахгүй (interactive
  // TransactionClient дээр $transaction методгүй) — оронд нь
  // withSavepoint()-оор SAVEPOINT ашиглаж, cart-ийн аль нэг мөр
  // амжилтгүй болвол ЗӨВХӨН энэ checkout-ийн бичсэн зүйлсийг (Order,
  // OrderItem-үүд, өмнөх амжилттай decrement-үүд) ROLLBACK TO SAVEPOINT-оор
  // буцаана — доорх withSavepoint()-ийн тайлбарыг үз.
  async checkout(customerId: string, dto: CheckoutOrderDto) {
    // Үнэ тооцоолол (READ-ONLY) — SAVEPOINT-ын гадна, учир нь юу ч бичихгүй.
    const resolvedItems = await Promise.all(
      dto.items.map((item) => this.resolveCheckoutItem(item, dto.branchId)),
    );
    const totalAmount = resolvedItems.reduce(
      (sum, item) => sum.add(item.unitPrice.mul(item.quantity)),
      new Prisma.Decimal(0),
    );

    // ⚠️ Чухал заль: `orders_update` RLS policy (20260816094000) нь
    // CUSTOMER-ийн UPDATE-г ЗӨВХӨН status='CREATED'→'CANCELLED' шилжилтэд
    // л зөвшөөрдөг (§7 модуль #6 cancel) — өөрөөр хэлбэл CUSTOMER өөрийн
    // ШИНЭЭР үүсгэсэн CREATED захиалгандаа providerInvoiceId нэмж UPDATE
    // хийх боломжгүй (status өөрчлөгдөхгүй тул WITH CHECK-ийн аль ч
    // тал таарахгүй). Үүнийг шинэ SECURITY DEFINER функцгүйгээр (ADR 005
    // зарчим: аль болох одоо байгаа механизмаар шийд) тойрохын тулд
    // orderId-г Prisma-ийн DB талын `@default(uuid())`-ийн оронд ЭНД
    // (application код) урьдчилж үүсгэж, PaymentProvider.createInvoice()-г
    // Order мөр ҮҮСГЭХЭЭС ӨМНӨ дуудаж, `providerInvoiceId`-г эхний INSERT
    // дотор нь шууд оруулна — `orders_insert` policy providerInvoiceId
    // баганад хязгаарлалт тавьдаггүй тул энгийн CREATE-ээр л хангагдана.
    const orderId = randomUUID();
    // Санамж (docs/adr/006): энэ дуудлага SAVEPOINT/DB бичилтээс ӨМНӨ
    // (гадна) хийгдэх тул хэрэв дараагийн DB бичилт (нөөц дутах гэх мэт)
    // амжилтгүй болвол payment provider талд "эзэнгүй" (orphaned) invoice
    // үлдэх эрсдэлтэй — MVP-д зөвшөөрөгдөх, ADR 006-д тэмдэглэсэн.
    const invoice = await this.paymentProvider.createInvoice(
      orderId,
      totalAmount.toNumber(),
    );

    const result = await this.withSavepoint(async () => {
      const order = await this.createOrderRow(
        orderId,
        customerId,
        dto.branchId,
        totalAmount,
        invoice.providerInvoiceId,
      );

      await this.prisma.tx.orderItem.createMany({
        data: resolvedItems.map((item) => ({
          orderId: order.id,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPriceSnapshot: item.unitPrice,
        })),
      });

      for (const item of resolvedItems) {
        await this.adjustInventory(
          order.id,
          dto.branchId,
          item.variantId,
          -item.quantity,
        );
      }

      return this.findOne(order.id);
    });

    return { ...result, payUrl: invoice.payUrl };
  }

  // Staff-ийн статус шинэчлэлт БОЛОН харилцагчийн cancel (docs/plan.md §7
  // модуль #6, §8 Phase 3a 4-5-р зүйл) — нэг endpoint-д нэгтгэсэн: role-оос
  // хамааран өөр өөр дүрмээр шилжилтийг шалгана.
  async updateStatus(
    id: string,
    requestingUserId: string,
    dto: UpdateOrderStatusDto,
  ) {
    const order = await this.findOne(id);
    const roles = await resolveUserRoleNames(this.prisma.tx, requestingUserId);
    const isStaff = roles.some((r) =>
      STAFF_STATUS_ROLES.includes(r as RoleName),
    );

    if (isStaff) {
      if (!isOrderTransitionAllowed(order.status, dto.status)) {
        throw new BadRequestException(INVALID_TRANSITION);
      }
    } else if (
      order.customerId !== requestingUserId ||
      order.status !== 'CREATED' ||
      dto.status !== 'CANCELLED'
    ) {
      // Харилцагч зөвхөн ӨӨРИЙН, status='CREATED' захиалгаа 'CANCELLED'
      // болгож болно (даалгаврын шууд заавар) — orders_update RLS
      // policy-той (WITH CHECK) давхар нийцнэ.
      throw new BadRequestException(INVALID_TRANSITION);
    }

    const result = await this.withSavepoint(async () => {
      if (isRestockingTransition(dto.status)) {
        for (const item of order.items) {
          await this.adjustInventory(
            order.id,
            order.branchId,
            item.variantId,
            item.quantity,
          );
        }
      }

      await this.updateOrderStatusRow(id, dto.status);
      return this.findOne(id);
    });

    // docs/plan.md §8 Phase 3b, Хэсэг A #2: SAVEPOINT амжилттай RELEASE
    // хийгдсэний ДАРАА л publish дуудна (withSavepoint дундаас биш) —
    // хэрэв withSavepoint дотор шидвэл (жиш: дараагийн restock мөр
    // амжилтгүй болвол) энэ дуудлага огт хийгдэхгүй, "худал" event
    // огт бүртгэгдэхгүй. Бодит Redis publish нь ЭНДЭЭС ч ХОЙШ, зөвхөн
    // RlsMiddleware-ийн бүхэл транзакц commit хийгдсэний ДАРАА л явагдана
    // (OrderEventsPublisher-ийн `onCommit()`-г үз).
    this.orderEvents.publishOrderStatusChanged({
      orderId: order.id,
      branchId: order.branchId,
      customerId: order.customerId,
      oldStatus: order.status,
      newStatus: dto.status,
    });

    return result;
  }

  private async resolveCheckoutItem(
    item: CheckoutOrderItemDto,
    branchId: string,
  ): Promise<ResolvedCheckoutItem> {
    const variant = await this.prisma.tx.productVariant.findUnique({
      where: { id: item.variantId },
    });
    if (!variant || !variant.isActive) {
      throw new BadRequestException({
        code: 'PRODUCT_VARIANT_NOT_FOUND',
        message: 'Захиалсан бүтээгдэхүүний хувилбар олдсонгүй',
      });
    }

    // CUSTOMER inventory_items хүснэгтийг шууд SELECT хийх эрхгүй тул
    // (docs/adr/005) app_inventory_snapshot_for_variant() SECURITY
    // DEFINER функцээр л branchPrice override-ыг уншина.
    const rows = await this.prisma.tx.$queryRaw<InventorySnapshotRow[]>`
      SELECT * FROM app_inventory_snapshot_for_variant(${item.variantId}, ${branchId})
    `;
    const snapshot = rows[0] ?? null;
    const branchPrice =
      snapshot?.branchPrice != null
        ? new Prisma.Decimal(snapshot.branchPrice)
        : null;
    const unitPrice = resolveEffectivePrice(
      { branchPrice },
      { basePrice: variant.basePrice },
    );

    return { variantId: item.variantId, quantity: item.quantity, unitPrice };
  }

  private async createOrderRow(
    id: string,
    customerId: string,
    branchId: string,
    totalAmount: Prisma.Decimal,
    providerInvoiceId: string,
  ) {
    try {
      return await this.prisma.tx.order.create({
        data: {
          id,
          customerId,
          branchId,
          status: 'CREATED',
          totalAmount,
          providerInvoiceId,
        },
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException({
          code: 'BRANCH_NOT_FOUND',
          message: 'Заасан салбар олдсонгүй',
        });
      }
      throw error;
    }
  }

  private async updateOrderStatusRow(id: string, status: OrderStatus) {
    await this.prisma.tx.order.update({
      where: { id },
      data: {
        status,
        completedAt: status === 'COMPLETED' ? new Date() : undefined,
        cancelledAt: status === 'CANCELLED' ? new Date() : undefined,
      },
    });
  }

  // delta<0 = decrement (checkout), delta>0 = increment (cancel restock).
  // ⚠️ Чухал заль (20260816095000 migration-ийг үз): Postgres-ийн UPDATE
  // команд RETURNING байх эсэхээс ҮЛ ХАМААРАН зорилтот мөрөө тодорхойлохын
  // тулд SELECT policy-г ЗААВАЛ давхар хангасан байхыг шаарддаг тул raw
  // `$executeRaw` UPDATE ашиглах нь энд ажиллахгүй (CUSTOMER/SALESPERSON
  // inventory_items-ийг SELECT хийх эрхгүй, "нөөцийн тоо нууц" §6.1). Иймд
  // app_adjust_inventory_for_order() SECURITY DEFINER функц ашиглана —
  // энэ нь дотроо ӨӨРӨӨ (order_items-ээр join хийж) зөвшөөрлийг шалгаад,
  // RLS-ийг бүрэн тойрч бичнэ.
  private async adjustInventory(
    orderId: string,
    branchId: string,
    variantId: string,
    delta: number,
  ): Promise<void> {
    let rowCount: number;
    try {
      const rows = await this.prisma.tx.$queryRaw<
        { app_adjust_inventory_for_order: number }[]
      >`
        SELECT app_adjust_inventory_for_order(${orderId}, ${variantId}, ${branchId}, ${delta}::integer)
      `;
      rowCount = rows[0]?.app_adjust_inventory_for_order ?? 0;
    } catch (error) {
      if (
        isCheckConstraintViolation(error, 'inventory_items_quantity_nonneg')
      ) {
        throw new ConflictException(OUT_OF_STOCK);
      }
      throw error;
    }

    if (rowCount === 0) {
      if (delta < 0) {
        // Энэ салбар/variant хослолд InventoryItem мөр огт үүсээгүй —
        // захиалах зүйлгүй, checkout амжилтгүй.
        throw new ConflictException(OUT_OF_STOCK);
      }
      // Cancel-ийн restock: мөр байхгүй бол (жиш: админ устгасан) буцаах
      // зүйлгүй тул зөвхөн анхааруулаад үргэлжлүүлнэ — cancel-ийг
      // блоклохгүй.
      this.logger.warn(
        `Нөөц буцаах InventoryItem олдсонгүй (variantId=${variantId}, branchId=${branchId}) — алгасав`,
      );
    }
  }

  // RlsMiddleware-ийн request-scoped transaction (docs/adr/001) дотор
  // SAVEPOINT нээж, cart дэх аль нэг мөрийн decrement CHECK constraint
  // зөрчигдвөл (эсвэл InventoryItem мөр байхгүй бол) ЗӨВХӨН энэ checkout/
  // status-update-ийн бичсэн зүйлсийг (Order/OrderItem үүсгэлт, өмнөх
  // амжилттай decrement/increment-үүд) ROLLBACK TO SAVEPOINT-оор буцаана.
  //
  // ⚠️ Чухал заль: Prisma-гийн interactive TransactionClient (`tx`) дээр
  // `$transaction` метод байхгүй (deny-list-д орсон) тул nested
  // транзакц ашиглах боломжгүй. Мөн Postgres-ийн "0 мөр олдсонгүй" (жиш:
  // InventoryItem мөр байхгүй) нь ЖИНХЭНЭ Postgres алдаа БИШ (statement
  // амжилттай, зүгээр 0 мөр өөрчилсөн) тул CHECK constraint зөрчил шиг
  // транзакцыг автоматаар "aborted" болгодоггүй — Order/OrderItem зэрэг
  // өмнөх мөрүүд SAVEPOINT-гүйгээр committed үлдэх эрсдэлтэй байсан.
  // Иймд аль ч төрлийн алдаа (JS-level throw эсвэл Postgres CHECK
  // constraint violation) гарсан ч ROLLBACK TO SAVEPOINT-ыг ЗААВАЛ
  // дуудна — энэ нь транзакцыг (aborted эсэх үл хамааран) SAVEPOINT-ийн
  // өмнөх эрүүл төлөвт буцаана.
  private async withSavepoint<T>(fn: () => Promise<T>): Promise<T> {
    const tx = this.prisma.tx;
    await tx.$executeRawUnsafe('SAVEPOINT order_service_mutation');
    try {
      const result = await fn();
      await tx.$executeRawUnsafe('RELEASE SAVEPOINT order_service_mutation');
      return result;
    } catch (error) {
      await tx.$executeRawUnsafe(
        'ROLLBACK TO SAVEPOINT order_service_mutation',
      );
      throw error;
    }
  }
}
