import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ReturnStatus } from '@prisma/client';
import { withSavepoint } from '../common/savepoint.util.js';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from '../payment/payment-provider.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrderEventsPublisher } from '../realtime/order-events.publisher.js';
import { SystemSettingService } from '../settings/system-setting.service.js';
import type { CreateReturnRequestDto } from './dto/create-return-request.dto.js';
import type { RejectReturnRequestDto } from './dto/reject-return-request.dto.js';
import {
  ACTIVE_RETURN_STATUSES,
  computeRefundAmount,
  isWithinReturnWindow,
} from './return-refund.util.js';

const RETURN_REQUEST_NOT_FOUND = {
  code: 'RETURN_REQUEST_NOT_FOUND',
  message: 'Буцаалтын хүсэлт олдсонгүй',
};
const ORDER_ITEM_NOT_FOUND = {
  code: 'ORDER_ITEM_NOT_FOUND',
  message: 'Захиалгын мөр олдсонгүй',
};
const ORDER_NOT_COMPLETED = {
  code: 'ORDER_NOT_COMPLETED',
  message: 'Зөвхөн хүргэгдсэн (COMPLETED) захиалгыг буцаах хүсэлт гаргаж болно',
};
const RETURN_WINDOW_EXPIRED = {
  code: 'RETURN_WINDOW_EXPIRED',
  message: 'Буцаах хугацаа (хүргэгдснээс хойш 7 хоног) дууссан байна',
};
const ACTIVE_RETURN_EXISTS = {
  code: 'ACTIVE_RETURN_REQUEST_EXISTS',
  message: 'Энэ барааны идэвхтэй буцаалтын хүсэлт аль хэдийн байна',
};
const RETURN_NOT_PENDING = {
  code: 'RETURN_REQUEST_NOT_PENDING',
  message: 'Энэ хүсэлт аль хэдийн шийдвэрлэгдсэн байна',
};

const ORDER_ITEM_INCLUDE = { orderItem: { include: { order: true } } } as const;

// docs/plan.md §7 модуль #9, §8 Phase 3c. ADR 005/006-ийг дахин ашигласан
// зарчмууд: (1) inventory restock-д шинэ SECURITY DEFINER функц ЗОХИОГООГҮЙ
// — app_adjust_inventory_for_order()-ийг дахин ашиглав (staff зөвшөөрөгч нь
// аль хэдийн тухайн функцийн app_can_manage_branch() нөхцлийг хангадаг);
// (2) refund-д идэвхтэй PaymentProvider-ийг л дуудна (QPay/mock аль алиныг
// дэмждэг абстракц, docs/adr/006).
@Injectable()
export class ReturnRequestService {
  private readonly logger = new Logger(ReturnRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettings: SystemSettingService,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
    private readonly orderEvents: OrderEventsPublisher,
  ) {}

  // RLS (return_requests_select) нь дүрд харагдахгүй мөрийг өөрөө шүүж
  // хасна (§6.1-ээс гаргасан migration policy) — status filter зөвхөн
  // тодруулга.
  findAll(filter: { status?: ReturnStatus }) {
    return this.prisma.tx.returnRequest.findMany({
      where: { status: filter.status },
      orderBy: { requestedAt: 'desc' },
      include: ORDER_ITEM_INCLUDE,
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.tx.returnRequest.findUnique({
      where: { id },
      include: ORDER_ITEM_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException(RETURN_REQUEST_NOT_FOUND);
    }
    return row;
  }

  // Харилцагчийн буцаалт хүсэх (§7 модуль #9 2. Business logic шалгалт).
  async create(requestedByUserId: string, dto: CreateReturnRequestDto) {
    // order_items_select RLS нь CUSTOMER-д зөвхөн ӨӨРИЙН захиалгын мөрийг
    // харуулдаг тул өөр хэрэглэгчийн orderItemId дамжуулбал энд null ирнэ
    // (эрхийн алдагдалгүйгээр 404) — return_requests_insert-ийн WITH CHECK
    // мөн адил join-оор давхар баталгаажуулна.
    const orderItem = await this.prisma.tx.orderItem.findUnique({
      where: { id: dto.orderItemId },
      include: { order: true },
    });
    if (!orderItem) {
      throw new NotFoundException(ORDER_ITEM_NOT_FOUND);
    }
    if (
      orderItem.order.status !== 'COMPLETED' ||
      !orderItem.order.completedAt
    ) {
      throw new BadRequestException(ORDER_NOT_COMPLETED);
    }
    if (!isWithinReturnWindow(orderItem.order.completedAt, new Date())) {
      throw new BadRequestException(RETURN_WINDOW_EXPIRED);
    }

    const activeExisting = await this.prisma.tx.returnRequest.findFirst({
      where: {
        orderItemId: dto.orderItemId,
        status: { in: ACTIVE_RETURN_STATUSES },
      },
    });
    if (activeExisting) {
      throw new ConflictException(ACTIVE_RETURN_EXISTS);
    }

    return this.prisma.tx.returnRequest.create({
      data: {
        orderItemId: dto.orderItemId,
        requestedByUserId,
        reason: dto.reason,
      },
      include: ORDER_ITEM_INCLUDE,
    });
  }

  // Зөвшөөрөх урсгал (§7 модуль #9 3): нэг PATCH дотор шимтгэл тооцож,
  // идэвхтэй PaymentProvider-ийн refundPayment()-ийг дуудаад амжилтаас
  // хамааран REFUNDED (+ нөөц буцаах) эсвэл REFUND_FAILED болгоно.
  // REFUND_FAILED-ээс дахин дуудвал ("гараар дахин оролдох боломжтой
  // байх" — §7 модуль #9 3(д)) энэ ЯГ ЛЭ функцийг дахин ажиллуулна —
  // тусдаа "retry" endpoint зохиогоогүй, зөвхөн REQUESTED-ийн зэрэгцээ
  // REFUND_FAILED-ийг ч эхлэх цэг болгож зөвшөөрөв.
  //
  // ⚠️ Playwright-аар (2 tab, бараг нэг зэрэг "Зөвшөөрөх" товч дарах)
  // илэрсэн race condition: анхны хувилбарт "findOne() → статус шалгах →
  // refundPayment() дуудах → update()" гэсэн дараалал ATOMIC биш байсан
  // тул хоёр зэрэг ирсэн хүсэлт ХОЁУЛАА findOne()-оор REQUESTED гэж
  // харж, ХОЁУЛАА PaymentProvider.refundPayment()-ийг дуудах боломжтой
  // байсан — санхүүгийн ХОЁР дахин refund хийгдэх ноцтой эрсдэл. Үүнийг
  // ReturnStatus enum-ийн (өмнө нь ашиглагдаагүй, зөвхөн "vestigial" гэж
  // тэмдэглэсэн байсан) `APPROVED` утгыг "claim" (эзэмших) тэмдэг
  // болгож ашиглаж шийдэв: `updateMany({where: {id, status: {in:
  // [REQUESTED, REFUND_FAILED]}}})`-г PaymentProvider-ийг дуудахаас
  // ӨМНӨ, withSavepoint-ийн ДОТОР гүйцэтгэнэ. Postgres-ийн UPDATE-ийн
  // мөрийн lock нь БҮХЭЛ хүсэлтийн транзакц (RlsMiddleware, ADR 001)
  // COMMIT хийгдэх хүртэл (SAVEPOINT RELEASE-ээр биш) баригддаг тул
  // зэрэг ирсэн хоёр дахь хүсэлтийн claim UPDATE Request 1-ийн бүхэл
  // транзакц дуусах хүртэл BLOCKED хүлээгээд, дараа нь committed
  // төлөвийг (APPROVED/REFUNDED, REQUESTED/REFUND_FAILED БИШ) харж 0 мөр
  // өөрчилнө — ЭНД Л (PaymentProvider-ийг ХОЁР дахин дуудахаас өмнө)
  // зогсоно.
  async approve(id: string, reviewingUserId: string) {
    const returnRequest = await this.findOne(id);

    const result = await withSavepoint(this.prisma.tx, async () => {
      const claim = await this.prisma.tx.returnRequest.updateMany({
        where: { id, status: { in: ['REQUESTED', 'REFUND_FAILED'] } },
        data: {
          status: 'APPROVED',
          reviewedByUserId: reviewingUserId,
          reviewedAt: new Date(),
        },
      });
      if (claim.count === 0) {
        throw new ConflictException(RETURN_NOT_PENDING);
      }

      const feePercent = await this.systemSettings.getReturnFeePercent();
      const refundAmount = computeRefundAmount(
        returnRequest.orderItem.unitPriceSnapshot,
        returnRequest.orderItem.quantity,
        feePercent,
      );

      let providerRefundId: string | null = null;
      let refundFailed = false;
      try {
        const refund = await this.paymentProvider.refundPayment(
          returnRequest.orderItem.order.providerInvoiceId ?? '',
          refundAmount.toNumber(),
        );
        providerRefundId = refund.providerRefundId;
      } catch (error) {
        refundFailed = true;
        this.logger.warn(
          `Буцаалтын refund амжилтгүй боллоо (returnRequestId=${id}): ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      await this.prisma.tx.returnRequest.update({
        where: { id },
        data: {
          status: refundFailed ? 'REFUND_FAILED' : 'REFUNDED',
          refundFeePercent: feePercent,
          refundAmount,
          providerRefundId,
          refundedAt: refundFailed ? null : new Date(),
        },
      });

      if (!refundFailed) {
        await this.restockInventory(returnRequest);
      }

      return this.findOne(id);
    });

    this.orderEvents.publishReturnStatusChanged({
      returnRequestId: id,
      orderId: returnRequest.orderItem.orderId,
      branchId: returnRequest.orderItem.order.branchId,
      customerId: returnRequest.orderItem.order.customerId,
      status: result.status,
    });

    return result;
  }

  // Татгалзах урсгал (§7 модуль #9 4): InventoryItem/refund ХӨНДӨХГҮЙ.
  async reject(
    id: string,
    reviewingUserId: string,
    dto: RejectReturnRequestDto,
  ) {
    const returnRequest = await this.findOne(id);
    if (returnRequest.status !== 'REQUESTED') {
      throw new ConflictException(RETURN_NOT_PENDING);
    }

    await this.prisma.tx.returnRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedReason: dto.rejectedReason,
        reviewedByUserId: reviewingUserId,
        reviewedAt: new Date(),
      },
    });
    const result = await this.findOne(id);

    this.orderEvents.publishReturnStatusChanged({
      returnRequestId: id,
      orderId: returnRequest.orderItem.orderId,
      branchId: returnRequest.orderItem.order.branchId,
      customerId: returnRequest.orderItem.order.customerId,
      status: result.status,
    });

    return result;
  }

  // ADR 005 WRITE ангиллын "өмнө нь бичигдсэн ижил зорилготой функц
  // байхгүй эсэхийг шалга" зарчмын дагуу app_adjust_inventory_for_order()-г
  // ШИНЭЭР зохиохгүй ДАХИН АШИГЛАВ: staff (энэ функцийг дуудаж буй
  // approve()-г зөвхөн REVIEW_ROLES/RLS-ээр зөвшөөрөгдсөн хэрэглэгч дуудна)
  // аль хэдийн app_can_manage_branch(branchId) нөхцлийг хангадаг тул уг
  // функцийн зөвшөөрлийн шалгалт (orders/order_items join) шууд даана.
  private async restockInventory(returnRequest: {
    orderItem: {
      orderId: string;
      variantId: string;
      quantity: number;
      order: { branchId: string };
    };
  }): Promise<void> {
    const { orderId, variantId, quantity, order } = returnRequest.orderItem;
    const rows = await this.prisma.tx.$queryRaw<
      { app_adjust_inventory_for_order: number }[]
    >`
      SELECT app_adjust_inventory_for_order(${orderId}, ${variantId}, ${order.branchId}, ${quantity}::integer)
    `;
    const rowCount = rows[0]?.app_adjust_inventory_for_order ?? 0;
    if (rowCount === 0) {
      this.logger.warn(
        `Буцаалтын нөөц буцаах InventoryItem олдсонгүй (variantId=${variantId}, branchId=${order.branchId}) — алгасав`,
      );
    }
  }
}
