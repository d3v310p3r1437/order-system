import 'dart:io' show Platform;

/// Backend-ийн base URL-г тодорхойлно.
///
/// ⚠️ ЧУХАЛ: Android emulator localhost-оо ӨӨРИЙГӨӨ зааж байгаа тул host
/// машины backend (`localhost:3100`) руу хандахын тулд `10.0.2.2:3100`
/// ашиглах ёстой. iOS simulator бол host-той сүлжээ хуваалцдаг тул
/// localhost:3100 шууд ажиллана. Жинхэнэ төхөөрөмжид host компьютерийн
/// LAN IP хэрэгтэй тул `--dart-define=API_BASE_URL=http://<LAN-IP>:3100`-ээр
/// дарж бичнэ (жиш: `flutter run --dart-define=API_BASE_URL=http://192.168.1.5:3100`).
String resolveApiBaseUrl() {
  const override = String.fromEnvironment('API_BASE_URL');
  if (override.isNotEmpty) {
    return override;
  }

  if (Platform.isAndroid) {
    return 'http://10.0.2.2:3100';
  }

  return 'http://localhost:3100';
}

/// Backend-ийн буцаадаг медиа (MinIO) URL — `MinioService.getPublicUrl()`-ийн
/// dev анхдагч нь `MINIO_URL`-аас (`http://localhost:9000`) шууд гарган
/// авдаг тул browser context-д (admin-web) зөв ажилладаг ч Android emulator
/// localhost-оо ӨӨРИЙГӨӨ зааж байгаа тул шууд ачаалахгүй — `resolveApiBaseUrl()`-тэй
/// ЯГ ижил host-солих зарчмыг зурган URL-д ч мөн хэрэглэнэ.
String resolveMediaUrl(String rawUrl) {
  if (!Platform.isAndroid) {
    return rawUrl;
  }
  final uri = Uri.tryParse(rawUrl);
  if (uri == null || (uri.host != 'localhost' && uri.host != '127.0.0.1')) {
    return rawUrl;
  }
  return uri.replace(host: '10.0.2.2').toString();
}
