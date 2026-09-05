-- RETURN_FEE_PERCENT-ийн (20260817130000_add_returns_and_settings) адил
-- анхны утга seed хийнэ — зөвхөн текст (MinIO upload шаардахгүй) тул
-- migration-д шууд INSERT хийхэд аюулгүй. STORE_LOGO_URL-ийг ЭНД
-- seed ХИЙХГҮЙ (бодит зураг upload хийх ёстой тул) — SystemSettingService
-- (branding хэсэг) logoUrl байхгүй үед null-ыг эелдэг fallback болгож
-- буцаадаг, `pnpm --filter api run seed:branding` script-ээр (docs/assets/
-- store_logo_square_1024.png-г MinIO-руу upload хийж URL-ыг бичдэг)
-- дараа нь бодит утгыг тавина.
INSERT INTO system_settings ("key", "value", "updatedByUserId", "updatedAt")
VALUES ('STORE_NAME', 'ЧАНАР', NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
