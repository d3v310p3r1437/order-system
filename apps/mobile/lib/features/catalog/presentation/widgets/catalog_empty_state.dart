import 'package:flutter/material.dart';

/// Хайлт/шүүлтээр илэрц олдоогүй үед харуулах дэлгэц — зөвхөн текст БИШ,
/// дүрстэй/тайлбартай (дизайны шаардлага).
class CatalogEmptyState extends StatelessWidget {
  const CatalogEmptyState({super.key, required this.query});

  final String query;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                color: theme.colorScheme.secondary,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.search_off_rounded,
                size: 40,
                color: theme.colorScheme.onSecondary,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              query.isEmpty ? 'Бүтээгдэхүүн олдсонгүй' : 'Илэрц олдсонгүй',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              query.isEmpty
                  ? 'Энэ ангилалд одоогоор бүтээгдэхүүн бүртгэгдээгүй байна'
                  : '"$query" гэсэн хайлтад тохирох бүтээгдэхүүн олдсонгүй.\nӨөр түлхүүр үгээр эсвэл ангилал сольж хайж үзнэ үү',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
