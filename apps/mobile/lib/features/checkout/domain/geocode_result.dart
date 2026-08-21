/// Nominatim (`docs/adr/009-flutter-map-nominatim.md`) `/search`-ийн нэг
/// мөр — зөвхөн AddressScreen-ийн хайлтын жагсаалтад хэрэгтэй талбарууд.
class GeocodeResult {
  const GeocodeResult({
    required this.displayName,
    required this.latitude,
    required this.longitude,
  });

  factory GeocodeResult.fromJson(Map<String, dynamic> json) {
    return GeocodeResult(
      displayName: json['display_name'] as String,
      latitude: double.parse(json['lat'] as String),
      longitude: double.parse(json['lon'] as String),
    );
  }

  final String displayName;
  final double latitude;
  final double longitude;
}
