import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../data/branding_repository.dart';
import '../domain/branding_info.dart';

final brandingRepositoryProvider = Provider<BrandingRepository>((ref) {
  return BrandingRepository(apiClient: ref.watch(apiClientProvider));
});

/// `categoriesProvider`-тэй (catalog_providers.dart) ЯГ ижил зарчим:
/// `autoDispose` БИШ энгийн `FutureProvider` тул апп бүхэл ажиллах
/// хугацаанд НЭГ удаа л дуудагдаж кэшлэгдэнэ (§Даалгавар 8-р зүйл — "апп
/// нээх бүрд дахин дуудахгүй байх").
final brandingProvider = FutureProvider<BrandingInfo>((ref) {
  return ref.watch(brandingRepositoryProvider).getBranding();
});
