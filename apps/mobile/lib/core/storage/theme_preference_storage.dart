import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Хэрэглэгчийн сонгосон `ThemeMode`-ыг (Систем/Гэрэл/Харанхуй)
/// `SharedPreferences`-д хадгална — access token шиг нууц мэдээлэл БИШ
/// тул `flutter_secure_storage`-ийн (`SecureTokenStorage`) оронд энгийн
/// хавтгай preference ашиглана.
class ThemePreferenceStorage {
  static const _key = 'theme_mode';

  Future<ThemeMode> read() async {
    final prefs = await SharedPreferences.getInstance();
    return switch (prefs.getString(_key)) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
  }

  Future<void> save(ThemeMode mode) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, mode.name);
  }
}
