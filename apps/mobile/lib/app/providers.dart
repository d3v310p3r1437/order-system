import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/network/api_client.dart';
import '../core/storage/secure_token_storage.dart';
import '../features/auth/presentation/auth_provider.dart';

final secureTokenStorageProvider = Provider<SecureTokenStorage>((ref) {
  return SecureTokenStorage();
});

/// `ref.invalidate` нь build дотор ДУУДАГДАХГҮЙ (зөвхөн `onUnauthorized`
/// callback дотор, 401 ирэх үед) тул `authProvider`-тай циклийн
/// dependency edge ҮҮСГЭХГҮЙ — Riverpod-ийн стандарт "logout on 401" загвар.
final apiClientProvider = Provider<ApiClient>((ref) {
  final storage = ref.watch(secureTokenStorageProvider);
  return ApiClient(
    tokenStorage: storage,
    onUnauthorized: () => ref.invalidate(authProvider),
  );
});
