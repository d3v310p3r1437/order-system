import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { RequestContextService } from '../common/request-context.js';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { CartService } from './cart.service.js';
import { AddCartItemDto } from './dto/add-cart-item.dto.js';
import { ValidateBranchDto } from './dto/validate-branch.dto.js';

// §7 модуль #5: сагс Redis-д хадгалагдана (Postgres mutation биш) тул
// @Audit() шаардлагагүй — гэхдээ userId ЗААВАЛ RequestContextService-ээс
// (JWT-ээр баталгаажсан) авна, клиентээс dto/param-аар дамжуулсан ямар ч
// утгыг ХЭЗЭЭ Ч итгэмжлэхгүй (order.controller.ts-ийн checkout()-той ижил
// зарчим) — өөр хэрэглэгчийн сагс руу хандах боломжгүйг test/cart.e2e-spec.ts
// баталгаажуулна.
@Controller('cart')
@UseGuards(RolesGuard)
export class CartController {
  constructor(
    private readonly cartService: CartService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get()
  @Roles('CUSTOMER')
  getCart() {
    return this.cartService.getCart(this.requireUserId());
  }

  @Post('items')
  @Roles('CUSTOMER')
  async addItem(@Body() dto: AddCartItemDto) {
    const userId = this.requireUserId();
    await this.cartService.addOrUpdateItem(userId, dto.variantId, dto.quantity);
    return this.cartService.getCart(userId);
  }

  @Delete('items/:variantId')
  @Roles('CUSTOMER')
  async removeItem(@Param('variantId') variantId: string) {
    const userId = this.requireUserId();
    await this.cartService.removeItem(userId, variantId);
    return this.cartService.getCart(userId);
  }

  @Delete()
  @Roles('CUSTOMER')
  async clear() {
    await this.cartService.clear(this.requireUserId());
    return { items: [] };
  }

  @Post('validate-branch')
  @Roles('CUSTOMER')
  validateBranch(@Body() dto: ValidateBranchDto) {
    return this.cartService.validateBranch(this.requireUserId(), dto.branchId);
  }

  private requireUserId(): string {
    const { userId } = this.requestContext.get();
    if (!userId) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Нэвтрээгүй байна',
      });
    }
    return userId;
  }
}
