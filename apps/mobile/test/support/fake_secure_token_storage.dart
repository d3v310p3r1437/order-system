import 'package:mobile/core/storage/secure_token_storage.dart';

/// Тестэд зориулсан in-memory хэрэгжилт — `flutter_secure_storage`-ийн
/// жинхэнэ platform channel (widget/unit тестэд боломжгүй) огт хөндөхгүй.
class FakeSecureTokenStorage extends SecureTokenStorage {
  String? _accessToken;
  String? _refreshToken;
  String? _phone;

  @override
  Future<String?> readAccessToken() async => _accessToken;

  @override
  Future<String?> readRefreshToken() async => _refreshToken;

  @override
  Future<String?> readPhone() async => _phone;

  @override
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    required String phone,
  }) async {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
    _phone = phone;
  }

  @override
  Future<void> clear() async {
    _accessToken = null;
    _refreshToken = null;
    _phone = null;
  }
}
