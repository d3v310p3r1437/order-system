import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../branding_providers.dart';

/// `GET /settings/branding`-ээс уншсан лого зураг (байхгүй/ачаалж байгаа/
/// алдаатай үед storeName-ийн эхний үсгээр initials badge) — admin-web-ийн
/// `BrandMark.tsx`-тэй ЯГ ижил зорилго, LoginScreen/RegisterScreen/
/// HomeScreen-ийн AppBar гурванд дахин ашиглана.
class BrandMark extends ConsumerWidget {
  const BrandMark({super.key, this.size = 32});

  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final brandingAsync = ref.watch(brandingProvider);
    final colorScheme = Theme.of(context).colorScheme;
    final logoUrl = brandingAsync.value?.logoUrl;
    final storeName = brandingAsync.value?.storeName ?? 'ЗС';

    Widget fallback() => Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: colorScheme.primary,
        borderRadius: BorderRadius.circular(size * 0.3),
      ),
      alignment: Alignment.center,
      child: Text(
        storeName.trim().substring(0, storeName.trim().length.clamp(0, 2)),
        style: TextStyle(
          color: colorScheme.onPrimary,
          fontWeight: FontWeight.bold,
          fontSize: size * 0.4,
        ),
      ),
    );

    if (logoUrl == null) {
      return fallback();
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(size * 0.3),
      child: CachedNetworkImage(
        imageUrl: logoUrl,
        width: size,
        height: size,
        fit: BoxFit.cover,
        placeholder: (_, _) => fallback(),
        errorWidget: (_, _, _) => fallback(),
      ),
    );
  }
}
