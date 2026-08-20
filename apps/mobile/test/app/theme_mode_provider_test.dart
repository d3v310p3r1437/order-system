import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/theme_mode_provider.dart';
import 'package:mobile/core/storage/theme_preference_storage.dart';

class _FakeThemePreferenceStorage implements ThemePreferenceStorage {
  ThemeMode? saved;
  ThemeMode initial = ThemeMode.system;

  @override
  Future<ThemeMode> read() async => initial;

  @override
  Future<void> save(ThemeMode mode) async {
    saved = mode;
  }
}

void main() {
  late _FakeThemePreferenceStorage fakeStorage;
  late ProviderContainer container;

  setUp(() {
    fakeStorage = _FakeThemePreferenceStorage();
    container = ProviderContainer(
      overrides: [
        themePreferenceStorageProvider.overrideWithValue(fakeStorage),
      ],
    );
    addTearDown(container.dispose);
  });

  test('хадгалагдсан утга байхгүй бол build() ThemeMode.system буцаана', () async {
    final mode = await container.read(themeModeProvider.future);
    expect(mode, ThemeMode.system);
  });

  test('хадгалагдсан утгыг build() уншиж буцаана', () async {
    fakeStorage.initial = ThemeMode.dark;
    container = ProviderContainer(
      overrides: [
        themePreferenceStorageProvider.overrideWithValue(fakeStorage),
      ],
    );
    final mode = await container.read(themeModeProvider.future);
    expect(mode, ThemeMode.dark);
  });

  test('setThemeMode нь state-ийг шинэчилж, storage-д хадгална', () async {
    await container.read(themeModeProvider.future);

    await container
        .read(themeModeProvider.notifier)
        .setThemeMode(ThemeMode.light);

    expect(container.read(themeModeProvider).value, ThemeMode.light);
    expect(fakeStorage.saved, ThemeMode.light);
  });
}
