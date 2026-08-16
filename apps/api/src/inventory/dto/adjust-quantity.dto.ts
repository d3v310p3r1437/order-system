import { IsInt, NotEquals } from 'class-validator';

export class AdjustQuantityDto {
  // Эерэг = нөөц нэмэгдэх (жиш: агуулахад орлого), сөрөг = хасагдах (жиш:
  // захиалгаар зарагдсан) — race condition-оос сэргийлж Prisma-гийн atomic
  // `{ increment: delta }`-аар хэрэгжинэ (InventoryService.adjustQuantity).
  @IsInt()
  @NotEquals(0)
  delta!: number;
}
