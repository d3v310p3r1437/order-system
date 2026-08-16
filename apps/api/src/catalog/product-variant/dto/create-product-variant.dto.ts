import { IsNumber, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreateProductVariantDto {
  @IsUUID()
  productId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;
}
