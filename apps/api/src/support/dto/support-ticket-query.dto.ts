import type {
  SupportTicketCategory,
  SupportTicketStatus,
} from '@prisma/client';
import { IsIn, IsOptional } from 'class-validator';

const STATUSES: SupportTicketStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
];
const CATEGORIES: SupportTicketCategory[] = [
  'ORDER_ISSUE',
  'PAYMENT_ISSUE',
  'DELIVERY_ISSUE',
  'PRODUCT_QUESTION',
  'ACCOUNT_ISSUE',
  'OTHER',
];

// GET /support-tickets: "статусаар шүүх" (даалгаврын заавар, 3) —
// category-г ч мөн нэмэв (admin-web-ийн "статус/ангиллаар шүүх" жагсаалт,
// 7-той нийцүүлэв).
export class SupportTicketQueryDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: SupportTicketStatus;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: SupportTicketCategory;
}
