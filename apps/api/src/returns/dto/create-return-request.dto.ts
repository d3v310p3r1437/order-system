import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateReturnRequestDto {
  @IsUUID()
  orderItemId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}
