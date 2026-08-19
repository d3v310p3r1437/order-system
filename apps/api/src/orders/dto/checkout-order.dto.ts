import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import type { OrderDeliveryMethod } from '@prisma/client';

export const DEFAULT_DELIVERY_METHOD: OrderDeliveryMethod = 'PICKUP';

export class CheckoutOrderItemDto {
  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

const DELIVERY_METHODS: OrderDeliveryMethod[] = ['PICKUP', 'DELIVERY'];

// Phase 4 §8 Хэсэг A #1: deliveryMethod=DELIVERY үед заавал, PICKUP үед
// байх ЁСГҮЙ (NULL) гэсэн хоёр чиглэлийн шаардлагыг НЭГ decorator дотор
// шийднэ — class-validator-ийн `@ValidateIf` нь нэг property дээр хэд
// хэдэн удаа давхар зарлагдвал (нэг нь "DELIVERY-д заавал", нөгөө нь
// "PICKUP-д хориотой") аль аргаар (AND/OR) нэгддэгийг баримт бичгээс
// тодорхой батлах боломжгүй тул (эх сурвалж тодорхойгүй — inputs
// validation, аюулгүй байдлын критик хэсэг тул таамаглалаар бичихгүй)
// эрсдэлгүй, ганц `registerDecorator`-т суурилсан custom validator
// ашиглав: нэг функц дотроо хоёр чиглэлийг ХАМТ, ТОДОРХОЙ шалгана.
function IsDeliveryField(
  isValidWhenDelivery: (value: unknown) => boolean,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (target: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'isDeliveryField',
      target: target.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const dto = args.object as CheckoutOrderDto;
          const method = dto.deliveryMethod ?? DEFAULT_DELIVERY_METHOD;
          if (method === 'DELIVERY') {
            return isValidWhenDelivery(value);
          }
          // PICKUP (эсвэл deliveryMethod огт өгөгдөөгүй, өгөгдмөл PICKUP):
          // талбар байх ЁСГҮЙ (NULL/undefined).
          return value === undefined || value === null;
        },
        defaultMessage(args: ValidationArguments): string {
          const dto = args.object as CheckoutOrderDto;
          const method = dto.deliveryMethod ?? DEFAULT_DELIVERY_METHOD;
          return method === 'DELIVERY'
            ? `${String(args.property)} нь DELIVERY захиалганд заавал шаардлагатай/буруу утгатай байна`
            : `${String(args.property)} нь PICKUP захиалганд байх ёсгүй`;
        },
      },
    });
  };
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidLatitude(value: unknown): boolean {
  return typeof value === 'number' && value >= -90 && value <= 90;
}

function isValidLongitude(value: unknown): boolean {
  return typeof value === 'number' && value >= -180 && value <= 180;
}

// MVP чиглүүлэлт (docs/plan.md §8 Phase 3a): харилцагчийн шууд сонгосон
// branchId = захиалгын салбар шууд, geolocation-based auto-routing биш
// (энэ огт өөр асуудал — Phase 4-ийн доорх deliveryLatitude/Longitude нь
// АЛЬ ХЭДИЙН сонгогдсон захиалганд хүргэх ЦЭГИЙГ илэрхийлнэ, салбар
// автоматаар сонгох биш).
export class CheckoutOrderDto {
  @IsUUID()
  branchId!: string;

  // Өгөгдөөгүй бол PICKUP гэж тооцно (Order.deliveryMethod-ийн Prisma
  // schema @default(PICKUP)-той нийцтэй, одоо байгаа checkout дуудлагууд
  // (жиш: test/orders.e2e-spec.ts, test/payment.e2e-spec.ts) энэ талбарыг
  // ОГТ илгээдэггүй байсныг эвдэхгүйн тулд заавал биш болгов).
  @IsOptional()
  @IsIn(DELIVERY_METHODS)
  deliveryMethod?: OrderDeliveryMethod;

  @IsDeliveryField(isNonEmptyString)
  deliveryAddress?: string;

  @IsDeliveryField(isValidLatitude)
  deliveryLatitude?: number;

  @IsDeliveryField(isValidLongitude)
  deliveryLongitude?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutOrderItemDto)
  items!: CheckoutOrderItemDto[];
}
