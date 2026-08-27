import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/domain/auth_state.dart';
import '../features/auth/presentation/auth_provider.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/auth/presentation/register_screen.dart';
import '../features/branch/presentation/branch_selection_screen.dart';
import '../features/cart/presentation/cart_screen.dart';
import '../features/catalog/presentation/catalog_screen.dart';
import '../features/catalog/presentation/product_detail_screen.dart';
import '../features/checkout/domain/checkout_result.dart';
import '../features/checkout/presentation/address_screen.dart';
import '../features/checkout/presentation/delivery_method_screen.dart';
import '../features/checkout/presentation/order_review_screen.dart';
import '../features/checkout/presentation/order_success_screen.dart';
import '../features/checkout/presentation/order_tracking_screen.dart';
import '../features/checkout/presentation/payment_screen.dart';
import '../features/orders/presentation/order_list_screen.dart';
import '../features/profile/presentation/profile_screen.dart';
import '../features/returns/presentation/return_request_screen.dart';
import '../features/reviews/domain/review.dart';
import '../features/reviews/presentation/product_reviews_screen.dart';
import '../features/reviews/presentation/review_form_screen.dart';
import '../features/support/presentation/new_ticket_screen.dart';
import '../features/support/presentation/support_ticket_detail_screen.dart';
import '../features/support/presentation/support_ticket_list_screen.dart';
import 'home_screen.dart';
import 'main_shell.dart';
import 'settings_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/login',
    refreshListenable: GoRouterRefreshNotifier(ref),
    redirect: (context, state) {
      final authState = ref.read(authProvider);
      // Session хараахан ачаалж дуусаагүй бол шилжилт хийхгүй хүлээнэ.
      if (authState.isLoading && !authState.hasValue) {
        return null;
      }
      final isAuthenticated = switch (authState.value) {
        AuthAuthenticated() => true,
        _ => false,
      };
      final isAuthRoute =
          state.matchedLocation == '/login' ||
          state.matchedLocation == '/register';

      if (!isAuthenticated && !isAuthRoute) {
        return '/login';
      }
      if (isAuthenticated && isAuthRoute) {
        return '/home';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      // 4 үндсэн tab — `MainShell`-ийн доод navigation bar-аар сэлгэнэ
      // (§8 навигацийн цэгцлэлт). Доторх "гүнзгий" route-ууд (жиш:
      // /orders/:id, /products/:id) энэ shell-ийн ГАДНА, өмнөх шигээ
      // бие даасан бүтэн дэлгэц (bottom nav-гүй) хэвээр байна.
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            MainShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/home',
                builder: (context, state) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/catalog',
                builder: (context, state) => const CatalogScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/orders',
                builder: (context, state) => const OrderListScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/profile',
                builder: (context, state) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/settings',
        builder: (context, state) => const SettingsScreen(),
      ),
      GoRoute(
        path: '/products/:id',
        builder: (context, state) => ProductDetailScreen(
          productId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(path: '/cart', builder: (context, state) => const CartScreen()),
      GoRoute(
        path: '/products/:id/reviews',
        builder: (context, state) => ProductReviewsScreen(
          productId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/products/:id/review',
        builder: (context, state) => ReviewFormScreen(
          productId: state.pathParameters['id']!,
          existingReview: state.extra as Review?,
        ),
      ),
      GoRoute(
        path: '/branch-select',
        builder: (context, state) => const BranchSelectionScreen(),
      ),
      GoRoute(
        path: '/checkout/delivery-method',
        builder: (context, state) => const DeliveryMethodScreen(),
      ),
      GoRoute(
        path: '/checkout/address',
        builder: (context, state) => const AddressScreen(),
      ),
      GoRoute(
        path: '/checkout/review',
        builder: (context, state) => const OrderReviewScreen(),
      ),
      GoRoute(
        path: '/orders/:id/payment',
        builder: (context, state) => PaymentScreen(
          orderId: state.pathParameters['id']!,
          checkoutResult: state.extra as CheckoutResult?,
        ),
      ),
      GoRoute(
        path: '/orders/:id/success',
        builder: (context, state) =>
            OrderSuccessScreen(orderId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/orders/:id/return',
        builder: (context, state) =>
            ReturnRequestScreen(orderId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/orders/:id',
        builder: (context, state) =>
            OrderTrackingScreen(orderId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/support',
        builder: (context, state) => const SupportTicketListScreen(),
      ),
      GoRoute(
        path: '/support/new',
        // OrderTrackingScreen-ий "Тусламж хүсэх" товч (§7 модуль #13, 11)
        // orderId+category=ORDER_ISSUE-г `extra`-аар урьдчилан дамжуулна.
        builder: (context, state) {
          final extra = state.extra as Map<String, String>?;
          return NewTicketScreen(
            initialOrderId: extra?['orderId'],
            initialCategory: extra?['category'],
          );
        },
      ),
      GoRoute(
        path: '/support/:id',
        builder: (context, state) => SupportTicketDetailScreen(
          ticketId: state.pathParameters['id']!,
        ),
      ),
    ],
  );
});

/// `AuthNotifier`-ийн төлөв өөрчлөгдөх бүрд go_router-ийн redirect-ийг
/// дахин тооцоолуулна (401→`ref.invalidate(authProvider)`-оор
/// автоматаар logout болоход ч мөн адил дуудагдана).
class GoRouterRefreshNotifier extends ChangeNotifier {
  GoRouterRefreshNotifier(Ref ref) {
    ref.listen(authProvider, (previous, next) => notifyListeners());
  }
}
