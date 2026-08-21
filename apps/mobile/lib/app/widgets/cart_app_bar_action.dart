import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/cart/presentation/cart_providers.dart';

/// 4 үндсэн tab (Нүүр/Каталог/Захиалгууд/Профайл) бүрийн AppBar-д тогтмол
/// харагдах сагсны icon (badge-тэй) — `HomeScreen`-ийн хуучин
/// `open_cart_button`-ыг эндээс дахин ашигладаг болгосон (§8 навигацийн
/// цэгцлэлт).
class CartAppBarAction extends ConsumerWidget {
  const CartAppBarAction({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cartItemCount = ref.watch(cartItemCountProvider);
    return IconButton(
      key: const Key('open_cart_button'),
      icon: Badge(
        label: Text('$cartItemCount'),
        isLabelVisible: cartItemCount > 0,
        child: const Icon(Icons.shopping_cart_outlined),
      ),
      tooltip: 'Сагс',
      onPressed: () => context.push('/cart'),
    );
  }
}
