import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { PHONE_E164_REGEX } from '../phone.js';

export class LoginDto {
  @IsString()
  @Matches(PHONE_E164_REGEX, {
    message: 'Утасны дугаар E.164 форматтай байх ёстой (жиш: +97688112233)',
  })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
