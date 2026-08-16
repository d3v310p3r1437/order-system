import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  brand?: string;

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
