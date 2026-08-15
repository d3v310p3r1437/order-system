-- ============================================================
-- Харилцагчийн (customer) утасны дугаараар нэвтрэх (login) урсгал
-- анонимаар эхэлдэг тул users_select RLS policy (id = app_current_user_id())
-- нөхцөл хараахан хангагдаагүй байх үед ажиллах ёстой — өөрөөр хэлбэл
-- "хэн нэвтрэх гэж байгааг мэдэхийн тулд эхлээд DB-ээс асуух ёстой,
-- гэтэл DB-ээс асуухын тулд хэн болохоо мэдэх ёстой" гэсэн mөргөлдөөн.
--
-- app_has_global_scope() загварын адил SECURITY DEFINER функцээр (зөвхөн
-- `id`-г буцаадаг, нууц үг hash зэрэг бусад багана огт дэлгэдэггүй)
-- энэ мөргөлдөөнийг шийднэ. auth-customer.service.ts эхлээд энэ функцээр
-- id-г олоод, дараа нь app.user_id-г тухайн id болгож (SET LOCAL-тэй
-- адилаар) тохируулснаар users_select policy энгийнээр (id =
-- app_current_user_id()) бүрэн мөрийг (passwordHash-тай хамт) уншихыг
-- зөвшөөрдөг болно.
-- ============================================================

CREATE OR REPLACE FUNCTION app_find_customer_id_by_phone(target_phone text) RETURNS text
SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM users
  WHERE phone = target_phone AND "authProvider" = 'CUSTOMER_AUTH'
  LIMIT 1;
$$ LANGUAGE sql STABLE;
