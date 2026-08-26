import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'review_providers.dart';
import 'widgets/review_tile.dart';

/// "Бүгдийг харах" дараа орох бүтэн жагсаалт (§7 модуль #11 6-р зүйл).
class ProductReviewsScreen extends ConsumerWidget {
  const ProductReviewsScreen({super.key, required this.productId});

  final String productId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final reviewsAsync = ref.watch(productReviewsProvider(productId));

    return Scaffold(
      appBar: AppBar(title: const Text('Бүх сэтгэгдэл')),
      body: reviewsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Text(
            'Сэтгэгдэл ачаалахад алдаа гарлаа',
            style: theme.textTheme.bodyMedium,
          ),
        ),
        data: (data) => data.reviews.isEmpty
            ? Center(
                child: Text(
                  'Сэтгэгдэл алга байна',
                  style: theme.textTheme.bodyMedium,
                ),
              )
            : ListView.separated(
                key: const Key('all_reviews_list'),
                padding: const EdgeInsets.all(16),
                itemCount: data.reviews.length,
                separatorBuilder: (context, _) => const Divider(),
                itemBuilder: (context, index) =>
                    ReviewTile(review: data.reviews[index]),
              ),
      ),
    );
  }
}
