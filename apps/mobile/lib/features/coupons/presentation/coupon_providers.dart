import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../data/coupon_repository.dart';

final couponRepositoryProvider = Provider<CouponRepository>((ref) {
  return CouponRepository(apiClient: ref.watch(apiClientProvider));
});
