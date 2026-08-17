import { IsNumber, Max, Min } from 'class-validator';

export class UpdateReturnFeePercentDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  value!: number;
}
