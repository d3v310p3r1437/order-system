import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/storage/theme_preference_storage.dart';

final themePreferenceStorageProvider = Provider<ThemePreferenceStorage>((ref) {
  return ThemePreferenceStorage();
});

/// Хэрэглэгчийн сонгосон theme горим — `SettingsScreen`-ээс өөрчилж,
/// `SharedPreferences`-д хадгалж апп дахин нээхэд сануулна.
/// `build()` ачаалж дуусаагүй (`AsyncLoading`) мөчид `OrderSystemApp`-ийн
/// `.value ?? ThemeMode.system` нь ЯГ анхны утгатай ижил тул хэрэглэгчид
/// ямар ч "flash" харагдахгүй.
class ThemeModeNotifier extends AsyncNotifier<ThemeMode> {
  @override
  Future<ThemeMode> build() {
    return ref.watch(themePreferenceStorageProvider).read();
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    state = AsyncData(mode);
    await ref.read(themePreferenceStorageProvider).save(mode);
  }
}

final themeModeProvider = AsyncNotifierProvider<ThemeModeNotifier, ThemeMode>(
  ThemeModeNotifier.new,
);
