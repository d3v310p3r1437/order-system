/// `apps/api/src/catalog/inventory-effective.util.ts`-ийн
/// `AvailabilityStatus`-тай ЯГ тохирно — шийдвэрийг ГАНЦ л газар (backend)
/// гаргадаг тул энд дахин тооцоолохгүй, зөвхөн ирсэн утгыг харуулна (ADR
/// 005-ийн "ганц газар л шийднэ" зарчим Flutter талд ч мөн хамаарна).
enum AvailabilityStatus { inStock, preOrder, outOfStock }

AvailabilityStatus _parseAvailabilityStatus(String raw) {
  switch (raw) {
    case 'IN_STOCK':
      return AvailabilityStatus.inStock;
    case 'PRE_ORDER':
      return AvailabilityStatus.preOrder;
    case 'OUT_OF_STOCK':
    default:
      return AvailabilityStatus.outOfStock;
  }
}

class AvailabilityResult {
  const AvailabilityResult({required this.status, this.leadDays});

  factory AvailabilityResult.fromJson(Map<String, dynamic> json) {
    return AvailabilityResult(
      status: _parseAvailabilityStatus(json['status'] as String),
      leadDays: json['leadDays'] as int?,
    );
  }

  final AvailabilityStatus status;
  final int? leadDays;
}
