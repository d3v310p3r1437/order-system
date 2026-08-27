import type { SupportTicketCategory } from '@prisma/client';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const CATEGORIES: SupportTicketCategory[] = [
  'ORDER_ISSUE',
  'PAYMENT_ISSUE',
  'DELIVERY_ISSUE',
  'PRODUCT_QUESTION',
  'ACCOUNT_ISSUE',
  'OTHER',
];

// Даалгаврын шууд заавар (§7 модуль #13, 3): POST /support-tickets нь
// subject/category/orderId?-г л хүлээн авна — эхний мессеж тусдаа POST
// /support-tickets/:id/messages дуудлагаар (create-support-message.dto.ts)
// нэмэгдэнэ.
export class CreateSupportTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @IsIn(CATEGORIES)
  category!: SupportTicketCategory;

  @IsOptional()
  @IsUUID()
  orderId?: string;
}
