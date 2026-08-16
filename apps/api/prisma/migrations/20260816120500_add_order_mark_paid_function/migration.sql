-- ============================================================
-- docs/plan.md §8 Phase 3b, Хэсэг B #10 (POST /payment/webhook/:orderId):
-- QPay (эсвэл Mock) provider-ийн webhook нь ХЭН Ч байж болох, session
-- (app.user_id) ОГТ ТОГТООГҮЙ хүсэлт тул (docs/adr/006-qpay-verify-dont-trust.md)
-- PaymentController нь `paymentProvider.checkPayment()`-ээр server-to-server
-- дахин баталгаажуулсны ДАРАА Order.paidAt-г бичих ёстой — гэвч ямар ч
-- session identity байхгүй тул `orders_update` RLS policy (аль ч дүрд
-- ч барихгүй, session хоосон) ХЭЗЭЭ Ч энэ UPDATE-г зөвшөөрөхгүй.
--
-- Энэ бол docs/adr/005-security-definer-pattern.md-ийн "WRITE" ангилалд
-- багтах ШИНЭ тохиолдол (§7 модуль #5/#6-ийн app_adjust_inventory_for_order-той
-- ЯГ ИЖИЛ суурь механизм: superuser "app" эзэмшигчтэй SECURITY DEFINER,
-- RLS-ийг бүрэн тойрдог) — ГЭХДЭЭ зөвшөөрлийн "нотолгоо" энд өөр хэлбэртэй:
-- session-based (app_current_user_id()) БИШ, харин "p_provider_invoice_id"
-- параметр нь ЯГ тухайн Order-д checkout/createInvoice үед БИД ӨӨРСДӨӨ
-- бичсэн утгатай таарах ёстой гэдгээрээ (WHERE-ийн хоёр дахь нөхцөл)
-- баталгаажина — webhook payload дэх ID-г ХЭЗЭЭ Ч цорын ганц эрх мэдэл
-- гэж үзэхгүй, зөвхөн PaymentController аль хэдийн checkPayment()-ээр
-- provider-той дахин баталгаажуулсны ДАРАА л дуудагдана (§4.4 "webhook
-- signature verification" мөрийг орлох "server-to-server re-check" зарчим).
--
-- Scope нарийн (зөвхөн `paidAt` багана, зөвхөн (id, providerInvoiceId)
-- хос яг таарсан НЭГ мөр, `"paidAt" IS NULL` нөхцөлөөр idempotent —
-- webhook давхар ирвэл (QPay-ийн бодит зан төлөв, эх сурвалж
-- баталгаажаагүй ч түгээмэл дизайн) хоёр дахь удаа 0 мөр өөрчилнө, алдаа
-- шидэхгүй).
-- ============================================================

CREATE FUNCTION app_mark_order_paid(
  p_order_id text,
  p_provider_invoice_id text
) RETURNS integer
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row_count integer;
BEGIN
  UPDATE orders
  SET "paidAt" = now()
  WHERE id = p_order_id
    AND "providerInvoiceId" = p_provider_invoice_id
    AND "paidAt" IS NULL;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  RETURN v_row_count;
END;
$$ LANGUAGE plpgsql;
