import 'package:mobile/features/checkout/data/location_service.dart';

/// `Geolocator`-ийн платформ давхарга огт хөндөхгүй fake —
/// `test/support/fake_cart_repository.dart`-ийн загвартай адил. `error`-г
/// `LocationPermissionDeniedException()`/`LocationServiceDisabledException()`
/// эсвэл ямар ч `Exception`-оор тохируулж зөвшөөрөгдөөгүй/алдааны
/// тохиолдлыг simulate хийнэ.
class FakeLocationService implements LocationService {
  LocationCoordinates? result;
  Object? error;
  Duration delay = Duration.zero;

  int callCount = 0;

  @override
  Future<LocationCoordinates> getCurrentLocation() async {
    callCount++;
    if (delay > Duration.zero) {
      await Future<void>.delayed(delay);
    }
    if (error != null) {
      throw error!;
    }
    return result!;
  }
}
