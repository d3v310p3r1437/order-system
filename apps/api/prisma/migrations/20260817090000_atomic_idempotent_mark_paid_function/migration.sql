-- ============================================================
-- docs/adr/006-qpay-verify-dont-trust.md-ийн "Webhook idempotency"
-- шинэчлэлт: 20260816120500_add_order_mark_paid_function-ийн
-- `app_mark_order_paid(text, text) RETURNS integer`-г ЗАСАЖ, дуудагч тал
-- (PaymentService) 0 мөр өөрчлөгдсөн шалтгааныг (аль хэдийн PAID vs
-- providerInvoiceId огт таарахгүй) ялгаж мэдэх боломжтой болгов —
-- Stripe/PayPal-ийн стандарт практик: webhook давхар (retry) ирсэн ч
-- алдаа шидэлгүй, "ALREADY_PROCESSED"-той адил утга буцааж ЗААВАЛ 200
-- OK хариулна (илгээгч тал дахин дахин retry хийхээс сэргийлнэ).
--
-- Буцаах утгыг мөн `branchId`/`customerId`-аар өргөтгөв — зөвхөн
-- 'MARKED_PAID' (шинээр PAID болсон) үед л WebSocket
-- `order.payment_confirmed` event нийтлэхэд хэрэгтэй (PaymentService
-- дахин unauthenticated session-ээс Order уншиж чадахгүй тул энэ
-- функц өөрөө буцаана — ADR 005 WRITE ангиллын "narrow scope" зарчим:
-- зөвхөн ЯГ ЭНЭ функц шинэчилсэн мөрийнхөө хоёр FK баганыг л
-- нэмж буцаана, өөр багана/хүснэгт рүү хамаарахгүй).
--
-- Буцаах утгын утгууд ('result' багана):
--   'MARKED_PAID'   — энэ дуудлагаар ШИНЭЭР paidAt тавигдсан.
--   'ALREADY_PAID'  — orderId+providerInvoiceId хос зөв таарсан ч
--                      paidAt өмнө нь аль хэдийн тавигдсан байсан
--                      (idempotent давталт — ердийн зан төлөв).
--   'MISMATCH'      — orderId олдсонгүй, эсвэл providerInvoiceId
--                      таарахгүй (docs/adr/006-ийн cross-order
--                      халдлагын хамгаалалт).
-- ============================================================

DROP FUNCTION IF EXISTS app_mark_order_paid(text, text);

CREATE FUNCTION app_mark_order_paid(
  p_order_id text,
  p_provider_invoice_id text
) RETURNS TABLE(result text, branch_id text, customer_id text)
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

  IF v_row_count > 0 THEN
    RETURN QUERY
      SELECT 'MARKED_PAID', o."branchId", o."customerId"
      FROM orders o WHERE o.id = p_order_id;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = p_order_id AND o."providerInvoiceId" = p_provider_invoice_id
  ) THEN
    RETURN QUERY SELECT 'ALREADY_PAID', NULL::text, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'MISMATCH', NULL::text, NULL::text;
END;
$$ LANGUAGE plpgsql;
