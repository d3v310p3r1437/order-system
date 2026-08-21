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
import { CartService, type CartItemRecord } from '../cart/cart.service.js';
import { resolveEffectivePrice } from '../catalog/inventory-effective.util.js';
import {
  isCheckConstraintViolation,
  isForeignKeyViolation,
} from '../common/prisma-errors.js';
import { RequestContextService } from '../common/request-context.js';
import { withSavepoint } from '../common/savepoint.util.js';
import { resolveUserRoleNames } from '../common/user-roles.js';
import { NotificationTrigger } from '../notification/notification-trigger.service.js';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from '../payment/payment-provider.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrderEventsPublisher } from '../realtime/order-events.publisher.js';
import {
  ROUTING_PROVIDER,
  type RouteResult,
  type RoutingProvider,
} from '../routing/routing-provider.interface.js';
import type { CheckoutOrderDto } from './dto/checkout-order.dto.js';
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
const NOT_DELIVERY_ORDER = {
  code: 'NOT_DELIVERY_ORDER',
  message: 'Зөвхөн DELIVERY захиалгад чиглэл тооцох боломжтой',
};
const BRANCH_LOCATION_MISSING = {
  code: 'BRANCH_LOCATION_MISSING',
  message: 'Салбарын байршил (latitude/longitude) бүртгэгдээгүй байна',
};
const CART_EMPTY = {
  code: 'CART_EMPTY',
  message: 'Сагс хоосон байна',
};

// Mobile-ийн Захиалгын түүх/Буцаалт хүсэх дэлгэцэд барааны нэр (жиш:
// "Кока-Кола 0.5Л") харуулах шаардлагатай болсон (§7 модуль #6, #9) тул
// нэмэв — Product/ProductVariant аль аль нь `*_select` RLS-ээр бүх
// нэвтэрсэн хэрэглэгчид (CUSTOMER-ийг оролцуулаад) нээлттэй тул шинэ
// SECURITY DEFINER функц/RLS өөрчлөлт ШААРДАГГҮЙ (ADR 005).
const ORDER_ITEM_VARIANT_INCLUDE = {
  variant: { include: { product: true } },
} as const;

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
    @Inject(ROUTING_PROVIDER) private readonly routingProvider: RoutingProvider,
    private readonly orderEvents: OrderEventsPublisher,
    private readonly notificationTrigger: NotificationTrigger,
    private readonly cartService: CartService,
    private readonly requestContext: RequestContextService,
  ) {}

  findAll(filter: { status?: OrderStatus; branchId?: string }) {
    // RLS (orders_select) нь дүрд харагдахгүй мөрийг өөрөө шүүж хасна —
    // энд дамжуулсан filter зөвхөн тодруулга.
    return this.prisma.tx.order.findMany({
      where: { status: filter.status, branchId: filter.branchId },
      orderBy: { createdAt: 'desc' },
      include: { items: { include: ORDER_ITEM_VARIANT_INCLUDE } },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.tx.order.findUnique({
      where: { id },
      include: { items: { include: ORDER_ITEM_VARIANT_INCLUDE } },
    });
    if (!order) {
      throw new NotFoundException(ORDER_NOT_FOUND);
    }
    return order;
  }

  // docs/plan.md §8 Phase 4, Хэсэг A #5: DELIVERY захиалгын салбараас
  // хүргэх цэг хүртэлх чиглэлийг RoutingProvider-аар тооцож буцаана.
  // ⚠️ Кэш (нэмэлт засвар): schema.prisma-ийн Order.routeDistanceMeters/
  // DurationSeconds/Geometry талбаруудыг үз — эхний дуудлагад л
  // RoutingProvider (OsrmRoutingProvider бол public demo server) дуудаж,
  // үр дүнг Order мөр дээр бичнэ; дараагийн дуудлага бүрд ЗӨВХӨН тэр
  // кэшийг л буцаана (RoutingProvider ОГТ дуудагдахгүй). deliveryLatitude/
  // Longitude/branchId одоогоор ЗАСВАРЛАГДАХГҮЙ (checkout-ийн дараа эдгээрийг
  // өөрчлөх endpoint байхгүй) тул кэш хугацаагүй хүчинтэй — цаашид ийм
  // засварлах боломж нэмэгдвэл яг тэр update-ийн дотор энэ 3 талбарыг NULL
  // болгож (invalidate) дахин тооцоолуулах ёстой.
  //
  // Энэ GET endpoint-ийн дотор Order мөрийг UPDATE хийдэг ч ЗОРИУДАА
  // @Audit()-гүй — audit_logs нь хэрэглэгчийн санаатай бизнес үйлдлийг
  // (checkout, статус шинэчлэх г.м.) тэмдэглэдэг, харин энэ бол зөвхөн
  // тооцоолсон утгын дотоод кэш (`POST /catalog/search/reindex`-ийн "DB
  // мутаци биш" зарчимтай төстэй логик, гэхдээ эсрэг чиглэлээс — энд
  // мутаци бий ч хэрэглэгчийн санаатай "үйлдэл" биш, дериватив утга).
  async getRoute(id: string): Promise<RouteResult> {
    const order = await this.findOne(id);
    if (order.deliveryMethod !== 'DELIVERY') {
      throw new BadRequestException(NOT_DELIVERY_ORDER);
    }
    // CheckoutOrderDto-ийн IsDeliveryField validation-аар DELIVERY захиалга
    // бүрт эдгээр талбар заавал бөглөгдсөн байх ёстой тул энэ бол
    // хамгаалалтын сүүлчийн шат (defensive), практикт хэзээ ч ажиллахгүй.
    if (order.deliveryLatitude == null || order.deliveryLongitude == null) {
      throw new BadRequestException(NOT_DELIVERY_ORDER);
    }

    if (
      order.routeDistanceMeters != null &&
      order.routeDurationSeconds != null &&
      order.routeGeometry != null
    ) {
      return {
        distanceMeters: order.routeDistanceMeters,
        durationSeconds: order.routeDurationSeconds,
        geometry: order.routeGeometry as [number, number][],
      };
    }

    const branch = await this.findBranchForRoute(order.branchId);
    if (!branch || branch.latitude == null || branch.longitude == null) {
      throw new BadRequestException(BRANCH_LOCATION_MISSING);
    }

    const route = await this.routingProvider.getRoute(
      { lat: branch.latitude, lng: branch.longitude },
      { lat: order.deliveryLatitude, lng: order.deliveryLongitude },
    );

    // ⚠️ (2026-08-20) `tx.order.update()` (typed Prisma) БИШ, ADR 005-ийн
    // шинэ WRITE функц ашиглана — `orders_update`-ийн WITH CHECK CUSTOMER-д
    // ЗӨВХӨН status='CANCELLED'-руу шилжихийг зөвшөөрдөг тул статустай
    // хамааралгүй энэ кэш-бичилт CUSTOMER-ийн session-ээр RLS-д
    // татгалзагдана (20260820140000 migration-ийг үз).
    await this.prisma.tx.$executeRaw`
      SELECT app_cache_order_route(${id}, ${route.distanceMeters}, ${route.durationSeconds}, ${JSON.stringify(route.geometry)}::jsonb)
    `;

    return route;
  }

  // ⚠️ (2026-08-20) branches_select RLS (`app_accessible_branch_ids()`)
  // ЗӨВХӨН staff (user_branch_roles мөртэй)-д зориулагдсан тул CUSTOMER-д
  // ХЭЗЭЭ Ч мөр буцаадаггүй (branch.service.ts-ийн ЯГ адилхан нээлт,
  // 20260820120000 migration) — order.controller.ts-ийн ROUTE_VIEW_ROLES-д
  // CUSTOMER нэмэгдсэнээр ЭНД ч давтагдсаныг e2e тестээр илрүүлсэн. Салбарын
  // байршил нууц МЭДЭЭЛЭЛ БИШ (дэлгүүрийн байршил, PICKUP-д ч харагдах
  // ёстой) тул ADR 005-ийн "READ-redact" зарчмаар app_public_branches()-г
  // (branch.service.ts-тэй адил, 20260820130000-аар p_branch_id параметр
  // нэмж өргөтгөсөн) CUSTOMER-ийн үед л ашиглана — staff хэвээр RLS-ээр
  // (`tx.branch.findUnique()`) шууд авна.
  private async findBranchForRoute(
    branchId: string,
  ): Promise<{ latitude: number | null; longitude: number | null } | null> {
    const { userId } = this.requestContext.get();
    const roles = userId
      ? await resolveUserRoleNames(this.prisma.tx, userId)
      : [];

    if (roles.includes('CUSTOMER')) {
      const rows = await this.prisma.tx.$queryRaw<
        { latitude: number | null; longitude: number | null }[]
      >`SELECT latitude, longitude FROM app_public_branches(${branchId})`;
      return rows[0] ?? null;
    }

    return this.prisma.tx.branch.findUnique({ where: { id: branchId } });
  }

  // Checkout: Order + OrderItem-үүдийг үүсгээд InventoryItem.quantity-г
  // ATOMIC decrement хийнэ (§7 модуль #5). RlsMiddleware хэдийн бүх
  // хүсэлтийг нэг interactive transaction-д ороосон байдаг (docs/adr/001)
  // тул энд `prisma.$transaction`-ыг ДАХИН дуудахгүй (interactive
  // TransactionClient дээр $transaction методгүй) — оронд нь
  // common/savepoint.util.ts-ийн withSavepoint()-оор SAVEPOINT ашиглаж,
  // cart-ийн аль нэг мөр амжилтгүй болвол ЗӨВХӨН энэ checkout-ийн бичсэн
  // зүйлсийг (Order, OrderItem-үүд, өмнөх амжилттай decrement-үүд)
  // ROLLBACK TO SAVEPOINT-оор буцаана — тэр файлын тайлбарыг үз.
  async checkout(customerId: string, dto: CheckoutOrderDto) {
    // ⚠️ (2026-08-20) Захиалгын item-үүд ХЭЗЭЭ Ч клиентийн HTTP body-оос
    // шууд ирэхгүй — зөвхөн Redis-ийн `cart:{userId}`-аас (харилцагч
    // өөрөө `POST /cart/items`-ээр аль хэдийн сервэр талд бичсэн
    // variantId/quantity) уншина. Үнийг (unitPrice) доор
    // resolveCheckoutItem() ЯГ адилхан InventoryItem/ProductVariant-аас
    // л тооцдог тул client dto items-тэй ижил аюулгүй байдал (клиентийн
    // үнэ хэзээ ч итгэмжлэгддэггүй байсан ч) — энэ өөрчлөлт зорилго нь
    // "cart нь цорын ганц эх сурвалж" гэсэн архитектурын нийцтэй байдал.
    const cartItems = await this.cartService.listForCheckout(customerId);
    if (cartItems.length === 0) {
      throw new BadRequestException(CART_EMPTY);
    }

    // Үнэ тооцоолол (READ-ONLY) — SAVEPOINT-ын гадна, учир нь юу ч бичихгүй.
    const resolvedItems = await Promise.all(
      cartItems.map((item) => this.resolveCheckoutItem(item, dto.branchId)),
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

    const result = await withSavepoint(this.prisma.tx, async () => {
      const order = await this.createOrderRow(
        orderId,
        customerId,
        dto.branchId,
        totalAmount,
        invoice.providerInvoiceId,
        dto,
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

    // Checkout бодитоор амжилттай (SAVEPOINT RELEASE хийгдсэн) ч, Redis
    // сагс цэвэрлэхийг ШУУД биш, RlsMiddleware-ийн бүхэл хүсэлтийн
    // транзакц бодитоор COMMIT хийгдсэний ДАРАА л хийнэ (SearchIndexer/
    // NotificationTrigger-тэй ЯГ ижил onCommit()-гэйт зарчим) — эс бөгөөс
    // хариу бичихэд ямар нэг алдаа гарч бүхэл транзакц rollback хийгдвэл
    // (Order бодитоор үүсээгүй бол ч) харилцагчийн сагс дэмий алдагдана.
    this.requestContext.onCommit(() => {
      this.cartService.clear(customerId).catch((err: unknown) => {
        this.logger.warn(
          `Checkout-ийн дараа Redis сагс цэвэрлэхэд алдаа гарлаа (orderId=${orderId}): ${String(err)}`,
        );
      });
    });

    return {
      ...result,
      payUrl: invoice.payUrl,
      qrText: invoice.qrText,
      bankDeeplinks: invoice.bankDeeplinks ?? [],
    };
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

    const result = await withSavepoint(this.prisma.tx, async () => {
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

    // docs/plan.md §8 Phase 4, Хэсэг B #14: NotificationTrigger-тэй ЯГ
    // ИЖИЛ COMMIT-ийн ДАРАА гэйт хамааралтай (SearchIndexer-тэй адил) ч,
    // харилцагчийн phone/email-г tx хараахан нээлттэй байхад уншихын
    // тулд (notification-trigger.service.ts-ийн тайлбарыг үз) ЗААВАЛ
    // `await` хийнэ.
    await this.notificationTrigger.notifyOrderStatusChanged({
      orderId: order.id,
      customerId: order.customerId,
      newStatus: dto.status,
    });

    return result;
  }

  private async resolveCheckoutItem(
    item: CartItemRecord,
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
    delivery: Pick<
      CheckoutOrderDto,
      | 'deliveryMethod'
      | 'deliveryAddress'
      | 'deliveryLatitude'
      | 'deliveryLongitude'
    >,
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
          deliveryMethod: delivery.deliveryMethod,
          deliveryAddress: delivery.deliveryAddress,
          deliveryLatitude: delivery.deliveryLatitude,
          deliveryLongitude: delivery.deliveryLongitude,
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
}
