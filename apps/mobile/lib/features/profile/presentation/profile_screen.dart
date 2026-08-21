import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/widgets/cart_app_bar_action.dart';
import '../../auth/domain/auth_state.dart';
import '../../auth/presentation/auth_provider.dart';

/// Профайл tab — утасны дугаар, Тохиргоо руу орох мөр, Гарах товч
/// (HomeScreen-ээс зөөв, §8 навигацийн цэгцлэлт).
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final authState = ref.watch(authProvider);
    final phone = switch (authState.value) {
      AuthAuthenticated(:final phone) => phone,
      _ => '',
    };

    return Scaffold(
      appBar: AppBar(
        title: const Text('Профайл'),
        actions: const [CartAppBarAction()],
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: 24),
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 32,
                  backgroundColor: theme.colorScheme.secondary,
                  child: Icon(
                    Icons.person_outline,
                    size: 32,
                    color: theme.colorScheme.onSecondary,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    phone,
                    key: const Key('profile_phone_text'),
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const Divider(height: 1),
          ListTile(
            key: const Key('profile_settings_tile'),
            leading: const Icon(Icons.settings_outlined),
            title: const Text('Тохиргоо'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/settings'),
          ),
          const Divider(height: 1),
          ListTile(
            key: const Key('profile_logout_tile'),
            leading: Icon(Icons.logout, color: theme.colorScheme.error),
            title: Text(
              'Гарах',
              style: TextStyle(color: theme.colorScheme.error),
            ),
            onTap: () => ref.read(authProvider.notifier).logout(),
          ),
          const Divider(height: 1),
        ],
      ),
    );
  }
}
