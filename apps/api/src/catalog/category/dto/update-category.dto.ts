import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // parentId-г эцгээ авах (root болгох) боломжтой байлгахын тулд `null`-ийг
  // мөн зөвшөөрнө — @IsOptional() нь null/undefined аль алиныг нь алгасаж
  // @IsUUID()-д хүргэдэггүй.
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}
