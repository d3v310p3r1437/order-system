import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// 4 үндсэн tab (Нүүр/Каталог/Захиалгууд/Профайл)-ын доод navigation bar
/// (Material 3 `NavigationBar`) — `StatefulShellRoute.indexedStack`-ийн
/// branch бүрийг доторх `navigationShell`-ээр харуулна (§8 навигацийн
/// цэгцлэлт). Tab бүрийн дэлгэц өөрийн AppBar-тай (Scaffold доторх
/// Scaffold, go_router-ийн стандарт shell загвар) тул энэ түвшинд AppBar
/// зохиогоогүй.
class MainShell extends StatelessWidget {
  const MainShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        key: const Key('main_bottom_nav'),
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (index) => navigationShell.goBranch(
          index,
          initialLocation: index == navigationShell.currentIndex,
        ),
        destinations: const [
          NavigationDestination(
            key: Key('main_bottom_nav_home'),
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Нүүр',
          ),
          NavigationDestination(
            key: Key('main_bottom_nav_catalog'),
            icon: Icon(Icons.storefront_outlined),
            selectedIcon: Icon(Icons.storefront),
            label: 'Каталог',
          ),
          NavigationDestination(
            key: Key('main_bottom_nav_orders'),
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: 'Захиалгууд',
          ),
          NavigationDestination(
            key: Key('main_bottom_nav_profile'),
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Профайл',
          ),
        ],
      ),
    );
  }
}
