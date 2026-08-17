import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectReturnRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  rejectedReason!: string;
}
