import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'theme_mode_provider.dart';

/// Тохиргооны дэлгэц — одоогоор зөвхөн харагдах горим (Систем/Гэрэл/
/// Харанхуй) сэлгэгчтэй, ирээдүйд өргөтгөх боломжтой (жиш: мэдэгдлийн
/// тохиргоо) гэж үзэж тусдаа route/дэлгэц болгосон.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeModeAsync = ref.watch(themeModeProvider);
    final currentMode = themeModeAsync.value ?? ThemeMode.system;
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Тохиргоо')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Харагдах горим',
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Систем сонговол төхөөрөмжийн тохиргоог дагана',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 16),
            SegmentedButton<ThemeMode>(
              key: const Key('theme_mode_segmented_button'),
              segments: const [
                ButtonSegment(
                  value: ThemeMode.system,
                  label: Text('Систем'),
                  icon: Icon(Icons.settings_suggest_outlined),
                ),
                ButtonSegment(
                  value: ThemeMode.light,
                  label: Text('Гэрэл'),
                  icon: Icon(Icons.light_mode_outlined),
                ),
                ButtonSegment(
                  value: ThemeMode.dark,
                  label: Text('Харанхуй'),
                  icon: Icon(Icons.dark_mode_outlined),
                ),
              ],
              selected: {currentMode},
              onSelectionChanged: (selection) {
                ref
                    .read(themeModeProvider.notifier)
                    .setThemeMode(selection.first);
              },
            ),
          ],
        ),
      ),
    );
  }
}
