-- ============================================================
-- docs/adr/006-qpay-verify-dont-trust.md: 'MISMATCH' (orderId/
-- providerInvoiceId хос таарахгүй байгаа — cross-order халдлагын
-- оролдлого эсвэл манай/QPay талын алдаа байж болзошгүй "сонор
-- сэрэмжтэй" аномали) тохиолдлыг PaymentService нь ERROR level лог
-- болгож (§10.4-ийн ирээдүйн Sentry холболтод бэлэн байлгах зорилгоор)
-- бичихийн тулд Order-д БОДИТООР хадгалагдсан providerInvoiceId-г
-- (олдвол) нэмж буцаадаг болгов — 20260817090000-ийн 3 баганатай
-- (result, branch_id, customer_id) TABLE-д дөрөв дэх багана нэмнэ.
--
-- ⚠️ ADR 005 WRITE ангиллын "narrow scope" зарчим: энэ нэмэлт багана
-- ЗӨВХӨН лог/diagnostics зорилготой (HTTP хариунд ил гарахгүй,
-- PaymentService дотор л ашиглагдана) — ямар ч нэмэлт эрх/өгөгдөл
-- задруулахгүй (аль хэдийн p_order_id-аар зорилтот мөрөө тодорхойлсон
-- байгаа, зөвхөн НЭГ баганыг нь нэмж уншиж байгаа).
-- ============================================================

DROP FUNCTION IF EXISTS app_mark_order_paid(text, text);

CREATE FUNCTION app_mark_order_paid(
  p_order_id text,
  p_provider_invoice_id text
) RETURNS TABLE(
  result text,
  branch_id text,
  customer_id text,
  actual_provider_invoice_id text
)
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row_count integer;
  v_actual_invoice_id text;
BEGIN
  UPDATE orders
  SET "paidAt" = now()
  WHERE id = p_order_id
    AND "providerInvoiceId" = p_provider_invoice_id
    AND "paidAt" IS NULL;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  IF v_row_count > 0 THEN
    RETURN QUERY
      SELECT 'MARKED_PAID', o."branchId", o."customerId", NULL::text
      FROM orders o WHERE o.id = p_order_id;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = p_order_id AND o."providerInvoiceId" = p_provider_invoice_id
  ) THEN
    RETURN QUERY SELECT 'ALREADY_PAID', NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- Order огт олдоогүй бол v_actual_invoice_id NULL хэвээр үлдэнэ
  -- (SELECT INTO мөр олдоогүй үед хувьсагчийг өөрчлөхгүй) —
  -- PaymentService энэ NULL-ийг "ORDER_NOT_FOUND" гэж тайлбарлана.
  SELECT o."providerInvoiceId" INTO v_actual_invoice_id
  FROM orders o WHERE o.id = p_order_id;

  RETURN QUERY SELECT 'MISMATCH', NULL::text, NULL::text, v_actual_invoice_id;
END;
$$ LANGUAGE plpgsql;
