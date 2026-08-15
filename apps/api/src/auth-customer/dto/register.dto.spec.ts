import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto.js';

async function validateDto(payload: Record<string, unknown>) {
  const instance = plainToInstance(RegisterDto, payload);
  return validate(instance);
}

describe('RegisterDto', () => {
  it('зөв E.164 утас + хүчинтэй нууц үгийг алдаагүй дамжуулна', async () => {
    const errors = await validateDto({
      phone: '+97688112233',
      password: 'Test1234!',
    });
    expect(errors).toHaveLength(0);
  });

  it('+ тэмдэггүй E.164 дугаарыг мөн зөвшөөрнө', async () => {
    const errors = await validateDto({
      phone: '97688112233',
      password: 'Test1234!',
    });
    expect(errors).toHaveLength(0);
  });

  it('буруу форматтай утасны дугаарыг татгалзана', async () => {
    const errors = await validateDto({
      phone: 'notaphone',
      password: 'Test1234!',
    });
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });

  it('0-ээр эхэлсэн дугаарыг татгалзана (E.164 эхний орон 1-9)', async () => {
    const errors = await validateDto({
      phone: '+012345678',
      password: 'Test1234!',
    });
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });

  it('8-аас богино нууц үгийг татгалзана', async () => {
    const errors = await validateDto({
      phone: '+97688112233',
      password: 'short1',
    });
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
});
