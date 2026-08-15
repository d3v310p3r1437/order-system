import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PHONE_E164_REGEX } from '../phone.js';

export class RegisterDto {
  @IsString()
  @Matches(PHONE_E164_REGEX, {
    message: 'Утасны дугаар E.164 форматтай байх ёстой (жиш: +97688112233)',
  })
  phone!: string;

  @IsString()
  @MinLength(8, { message: 'Нууц үг хамгийн багадаа 8 тэмдэгттэй байх ёстой' })
  @MaxLength(128)
  password!: string;
}
