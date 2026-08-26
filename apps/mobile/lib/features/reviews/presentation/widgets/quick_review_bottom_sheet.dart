import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_exception.dart';
import '../../../catalog/presentation/widgets/product_image_placeholder.dart';
import '../../domain/review.dart';
import '../review_providers.dart';
import 'star_rating_input.dart';

/// (2026-08-26) Захиалгын түүхийн карт дээрх "★ Үнэлэх" товч/одны
/// дарцгаанаас нээгддэг түргэн үнэлгээ өгөх/засварлах bottom sheet —
/// `ReviewFormScreen`-ийн бүтэн дэлгэцийн логиктой ЯГ ижил (verified-purchase
/// шалгалт зэрэг эцсийн баталгаажуулалт үргэлж backend талд), зөвхөн UI
/// нь bottom sheet хэлбэртэй. Дуудагч тал (`showQuickReviewBottomSheet()`)
/// амжилттай хадгалагдсан `Review`-г Navigator.pop(review)-оор хүлээж
/// авч, өөрийн (orders/product) орон нутгийн state-ээ шинэчилнэ — энэ
/// widget ЗОРИУДАА `OrderListNotifier`/`productReviewsProvider`-ийг огт
/// мэдэхгүй (дахин ашиглах боломжийг хадгалах зорилготой).
class QuickReviewBottomSheet extends ConsumerStatefulWidget {
  const QuickReviewBottomSheet({
    super.key,
    required this.productId,
    required this.productName,
    this.productImageUrl,
    this.existingReview,
  });

  final String productId;
  final String productName;
  final String? productImageUrl;
  final Review? existingReview;

  @override
  ConsumerState<QuickReviewBottomSheet> createState() =>
      _QuickReviewBottomSheetState();
}

class _QuickReviewBottomSheetState
    extends ConsumerState<QuickReviewBottomSheet> {
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
      final Review review;
      if (_isEdit) {
        review = await repository.update(
          reviewId: widget.existingReview!.id,
          rating: _rating,
          comment: comment,
        );
      } else {
        review = await repository.create(
          productId: widget.productId,
          rating: _rating,
          comment: comment,
        );
      }
      if (!mounted) {
        return;
      }
      Navigator.of(context).pop(review);
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    // ⚠️ (2026-08-27) `OrderListScreen` (энэ sheet-ийг нээдэг цорын ганц
    // дуудагч тал) `StatefulShellRoute`-ийн "Захиалгууд" branch дотор
    // байрладаг тул `showModalBottomSheet` (Navigator.of(context)-ийн
    // ХАМГИЙН ОЙР — branch-ийн дотоод, root биш) sheet-ийг `MainShell`-ийн
    // `Scaffold.body`-ийн дотор л (`bottomNavigationBar`-ын ГАДНА биш)
    // нээдэг тул физик дэлгэцийн доод ирмэг рүү бус, доод navigation
    // bar-ын дээд ирмэг рүү л суудаг. Иймд `SafeArea(bottom: true)`
    // энд голчлон КЛАВИАТУР нээгдэх/хаагдах үед МЭДЭГДЭХҮЙЦ зай өгөхийн
    // тулд бус, ирээдүйд ЭНЭ sheet-ийг navigation bar-гүй бүтэн дэлгэцээс
    // (жиш: ProductDetailScreen) дуудвал ч мөн адил зөв ажиллуулах
    // (gesture home indicator/notch-той төхөөрөмжид) хамгаалалт зорилготой.
    // Товч БОЛОН доод хил (клавиатур эсвэл navigation bar аль алиных нь)
    // хооронд ЗААВАЛ 20px тодорхой зай (SafeArea-гийн ДЭЭР нэмэлт) үлдээнэ.
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: SizedBox(
                    width: 44,
                    height: 44,
                    child: widget.productImageUrl != null
                        ? CachedNetworkImage(
                            imageUrl: widget.productImageUrl!,
                            fit: BoxFit.cover,
                            errorWidget: (_, _, _) =>
                                const ProductImagePlaceholder(iconSize: 18),
                          )
                        : const ProductImagePlaceholder(iconSize: 18),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    widget.productName,
                    style: theme.textTheme.titleSmall,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text('Хэдэн од өгөх вэ?', style: theme.textTheme.labelMedium),
            Center(
              child: StarRatingInput(
                rating: _rating,
                onChanged: (value) => setState(() => _rating = value),
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              key: const Key('quick_review_comment_field'),
              controller: _commentController,
              minLines: 2,
              maxLines: 4,
              maxLength: 2000,
              decoration: const InputDecoration(
                hintText: 'Тайлбар (заавал биш)...',
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                key: const Key('quick_review_submit_button'),
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
          ],
        ),
      ),
    );
  }
}

/// `showModalBottomSheet` дуудлагыг нэг газар нэгтгэсэн туслах функц —
/// амжилттай илгээгдвэл `onReviewSaved`-ыг дуудна (дуудагч тал
/// орон нутгийн state/SnackBar-аа өөрөө удирдана).
Future<void> showQuickReviewBottomSheet({
  required BuildContext context,
  required String productId,
  required String productName,
  String? productImageUrl,
  Review? existingReview,
  required ValueChanged<Review> onReviewSaved,
}) async {
  // ⚠️ (2026-08-27) Энэ sheet-ийг доод navigation bar-тай tab-аас
  // (OrderListScreen) нээдэг тул анхдагч M3 `elevation` (~1, маш сул
  // сүүдэртэй) дор доод navigation bar-аас арай тод ялгарахгүй байсан —
  // `elevation`-ийг тодорхой өндөр утгаар (12) заавал өгч, sheet-ийн
  // сүүдэр (доод хилийн ойролцоо хамгийн ил харагдах хэсэг) илүү тод
  // болгов. `clipBehavior: Clip.antiAlias` — дугуй булан + өндөр
  // elevation хосолсон үед агуулга (жиш: зурган карт) буланг давхарлан
  // гарахаас сэргийлнэ.
  final review = await showModalBottomSheet<Review>(
    context: context,
    isScrollControlled: true,
    elevation: 12,
    clipBehavior: Clip.antiAlias,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => QuickReviewBottomSheet(
      productId: productId,
      productName: productName,
      productImageUrl: productImageUrl,
      existingReview: existingReview,
    ),
  );
  if (review != null) {
    onReviewSaved(review);
  }
}
