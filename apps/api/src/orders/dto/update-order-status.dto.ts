import { IsIn } from 'class-validator';
import type { OrderStatus } from '@prisma/client';

// order.state-machine.ts-ийн ALLOWED_TRANSITIONS-д ашиглагдах бүх боломжит
// төлөв — энд зөвхөн "буруу enum утга" (жиш: typo) DTO түвшинд шүүнэ,
// шилжилтийн дүрэм (аль төлөвөөс аль рүү шилжиж болох) OrderService дотор.
const ALL_ORDER_STATUSES: OrderStatus[] = [
  'CREATED',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'COMPLETED',
  'CANCELLED',
];

export class UpdateOrderStatusDto {
  @IsIn(ALL_ORDER_STATUSES)
  status!: OrderStatus;
}
