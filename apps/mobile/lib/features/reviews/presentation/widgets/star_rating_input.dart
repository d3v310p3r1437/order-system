import 'package:flutter/material.dart';

/// Сонгож болох 5 одны rating сонголт (ReviewFormScreen-д ашиглагдана).
class StarRatingInput extends StatelessWidget {
  const StarRatingInput({
    super.key,
    required this.rating,
    required this.onChanged,
  });

  final int rating;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        final starValue = index + 1;
        final filled = starValue <= rating;
        return IconButton(
          key: Key('star_input_$starValue'),
          onPressed: () => onChanged(starValue),
          icon: Icon(
            filled ? Icons.star_rounded : Icons.star_border_rounded,
            color: Colors.amber.shade600,
            size: 32,
          ),
        );
      }),
    );
  }
}
