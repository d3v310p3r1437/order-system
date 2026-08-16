import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto.js';

async function validateDto(payload: Record<string, unknown>) {
  const instance = plainToInstance(LoginDto, payload);
  return validate(instance);
}

describe('LoginDto (auth-staff)', () => {
  it('зөв и-мэйл + нууц үгийг алдаагүй дамжуулна', async () => {
    const errors = await validateDto({
      email: 'staff@example.com',
      password: 'Test1234!',
    });
    expect(errors).toHaveLength(0);
  });

  it('буруу форматтай и-мэйлийг татгалзана', async () => {
    const errors = await validateDto({
      email: 'not-an-email',
      password: 'Test1234!',
    });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('хоосон нууц үгийг татгалзана', async () => {
    const errors = await validateDto({
      email: 'staff@example.com',
      password: '',
    });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
});
