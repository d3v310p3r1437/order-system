import 'package:geolocator/geolocator.dart';

/// `LocationService.getCurrentLocation()`-ийн буцаах координат.
class LocationCoordinates {
  const LocationCoordinates({required this.latitude, required this.longitude});

  final double latitude;
  final double longitude;
}

/// Байршлын үйлчилгээ (систем тохиргоо) унтраалттай, эсвэл байхгүй.
class LocationServiceDisabledException implements Exception {}

/// Хэрэглэгч зөвшөөрөл татгалзсан (нэг удаа эсвэл бүрмөсөн).
class LocationPermissionDeniedException implements Exception {}

/// `AddressScreen`-ийн анхны pin-д зориулж GPS байршил авах цэг —
/// `Geolocator`-ийн static метод шууд дуудахын оронд (widget тестэд
/// орлуулах боломжгүй тул) энэ давхаргаар тойрсон (`CartRepository`/
/// `CatalogRepository`-тэй ижил DI загвар).
class LocationService {
  Future<LocationCoordinates> getCurrentLocation() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw LocationServiceDisabledException();
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw LocationPermissionDeniedException();
    }

    // `LocationAccuracy.medium` — checkout-ийн хаяг pin-д GPS-ийн хамгийн
    // өндөр нарийвчлал (`best`) шаардлагагүй, харин хэрэглэгч удаан
    // хүлээхгүйн тулд хурдан хариу илүү чухал (шаардлага #3).
    final position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.medium,
      ),
    );
    return LocationCoordinates(
      latitude: position.latitude,
      longitude: position.longitude,
    );
  }
}
