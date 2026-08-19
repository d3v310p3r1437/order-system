import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Access/refresh JWT-г OS-ийн Keychain (iOS)/Keystore (Android)-д
/// хадгална — яагаад admin-web-ийн in-memory загвараас (ADR 004)
/// ялгаатай эсэхийг `docs/adr/008-mobile-token-storage.md`-ээс үз.
class SecureTokenStorage {
  // flutter_secure_storage 11.x-ээс хойш `AndroidOptions()`-ийн анхдагч
  // утга өөрөө аль хэдийн AES/GCM + RSA-OAEP key wrapping ашигладаг
  // (encryptedSharedPreferences-ийг тусад нь зааж өгөх шаардлагагүй болсон
  // — тухайн параметр v11-д устгагдсан).
  SecureTokenStorage({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';
  static const _phoneKey = 'phone';

  final FlutterSecureStorage _storage;

  Future<String?> readAccessToken() => _storage.read(key: _accessTokenKey);

  Future<String?> readRefreshToken() => _storage.read(key: _refreshTokenKey);

  /// Backend-ийн token хариунд харилцагчийн утасны дугаар ОРДОГГҮЙ (зөвхөн
  /// JWT `sub`, `docs/adr/002`-ийн "JWT identity-г л нотолно" зарчим) тул
  /// UI-ийн "Тавтай морил, {утас}" мэндчилгээнд ашиглахын тулд login/
  /// register-ийн үед оруулсан утгыг тусад нь хадгална.
  Future<String?> readPhone() => _storage.read(key: _phoneKey);

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    required String phone,
  }) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    await _storage.write(key: _refreshTokenKey, value: refreshToken);
    await _storage.write(key: _phoneKey, value: phone);
  }

  Future<void> clear() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
    await _storage.delete(key: _phoneKey);
  }
}
