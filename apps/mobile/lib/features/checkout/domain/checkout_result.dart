/// `apps/api/src/payment/payment-provider.interface.ts`-ийн `BankDeeplink`.
class BankDeeplink {
  const BankDeeplink({required this.bankName, required this.link});

  factory BankDeeplink.fromJson(Map<String, dynamic> json) {
    return BankDeeplink(
      bankName: json['bankName'] as String,
      link: json['link'] as String,
    );
  }

  final String bankName;
  final String link;
}

/// `POST /orders`-ийн (checkout) хариу — Order мөрийн үндсэн талбарууд +
/// `PaymentProvider.createInvoice()`-ийн буцаасан `payUrl`/`qrText`/
/// `bankDeeplinks` (ЗӨВХӨН checkout-ийн шууд хариунд байдаг, дараа нь
/// `GET /orders/:id`-ээр дахин уншихад ЭДГЭЭР талбар байхгүй).
class CheckoutResult {
  const CheckoutResult({
    required this.orderId,
    required this.status,
    this.providerInvoiceId,
    this.payUrl,
    this.qrText,
    required this.bankDeeplinks,
  });

  factory CheckoutResult.fromJson(Map<String, dynamic> json) {
    return CheckoutResult(
      orderId: json['id'] as String,
      status: json['status'] as String,
      providerInvoiceId: json['providerInvoiceId'] as String?,
      payUrl: json['payUrl'] as String?,
      qrText: json['qrText'] as String?,
      bankDeeplinks: (json['bankDeeplinks'] as List<dynamic>? ?? const [])
          .cast<Map<String, dynamic>>()
          .map(BankDeeplink.fromJson)
          .toList(),
    );
  }

  final String orderId;
  final String status;
  // ⚠️ `POST /payment/mock/simulate-paid/:providerInvoiceId`-д зориулж
  // (PaymentScreen-ийн debug товч) — Order.id-тэй ЯГ ЯЛГААТАЙ, provider
  // (mock/QPay)-ийн invoice ID (docs/adr/006-ыг үз).
  final String? providerInvoiceId;
  final String? payUrl;
  final String? qrText;
  final List<BankDeeplink> bankDeeplinks;
}
