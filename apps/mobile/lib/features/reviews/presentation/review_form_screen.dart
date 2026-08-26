import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../catalog/presentation/catalog_providers.dart';
import '../domain/review.dart';
import 'review_providers.dart';
import 'widgets/star_rating_input.dart';

/// Үнэлгээ өгөх/засварлах дэлгэц (§7 модуль #11) — `existingReview` өгөгдсөн
/// бол засварлах (PATCH), өгөгдөөгүй бол шинээр үүсгэх (POST). Layout нь
/// `ReturnRequestScreen`-тэй (`Column([Expanded(ListView), footer])`) ЯГ
/// ижил зарчим — CLAUDE.md-ийн "cart Phase"-ийн Scaffold.bottomNavigationBar
/// зөрчлийн сургамжийг дахин давтахгүйн тулд ЗОРИУДАА энэ загварыг
/// баримталсан.
class ReviewFormScreen extends ConsumerStatefulWidget {
  const ReviewFormScreen({
    super.key,
    required this.productId,
    this.existingReview,
  });

  final String productId;
  final Review? existingReview;

  @override
  ConsumerState<ReviewFormScreen> createState() => _ReviewFormScreenState();
}

class _ReviewFormScreenState extends ConsumerState<ReviewFormScreen> {
  late int _rating = widget.existingReview?.rating ?? 0;
  late final _commentController = TextEditingController(
    text: widget.existingReview?.comment ?? '',
  );
  bool _submitting = false;

  bool get _isEdit => widget.existingReview != null;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_rating == 0) {
      return;
    }
    setState(() => _submitting = true);
    final repository = ref.read(reviewRepositoryProvider);
    final comment = _commentController.text.trim();
    try {
      if (_isEdit) {
        await repository.update(
          reviewId: widget.existingReview!.id,
          rating: _rating,
          comment: comment,
        );
      } else {
        await repository.create(
          productId: widget.productId,
          rating: _rating,
          comment: comment,
        );
      }
      ref.invalidate(productDetailProvider(widget.productId));
      ref.invalidate(productReviewsProvider(widget.productId));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_isEdit ? 'Үнэлгээ шинэчлэгдлээ' : 'Үнэлгээ илгээгдлээ'),
        ),
      );
      context.pop();
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEdit ? 'Үнэлгээ засварлах' : 'Үнэлгээ өгөх'),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              key: const Key('review_form_list'),
              padding: const EdgeInsets.all(16),
              children: [
                Text('Хэдэн од өгөх вэ?', style: theme.textTheme.titleSmall),
                const SizedBox(height: 8),
                Center(
                  child: StarRatingInput(
                    rating: _rating,
                    onChanged: (value) => setState(() => _rating = value),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Тайлбар (заавал биш)',
                  style: theme.textTheme.titleSmall,
                ),
                const SizedBox(height: 8),
                TextField(
                  key: const Key('review_comment_field'),
                  controller: _commentController,
                  minLines: 3,
                  maxLines: 5,
                  maxLength: 2000,
                  decoration: const InputDecoration(
                    hintText:
                        'Бүтээгдэхүүний талаар санал бодлоо хуваалцана уу...',
                  ),
                ),
              ],
            ),
          ),
          SafeArea(
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: theme.colorScheme.surface,
                border: Border(top: BorderSide(color: theme.colorScheme.outline)),
              ),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  key: const Key('submit_review_button'),
                  onPressed: (_rating == 0 || _submitting) ? null : _submit,
                  child: _submitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text(_isEdit ? 'Хадгалах' : 'Илгээх'),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
