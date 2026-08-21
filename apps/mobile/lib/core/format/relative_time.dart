/// `OrderTrackingScreen`-ийн "сүүлд шинэчлэгдсэн" текстэд зориулсан —
/// интернэт хамааралгүй байлгах зорилгоор `timeago` багц ашиглалгүй,
/// гараар Монгол хэлээр бичсэн.
String formatRelativeTime(DateTime since, {DateTime? now}) {
  final diff = (now ?? DateTime.now()).difference(since);
  if (diff.inSeconds < 45) {
    return 'дөнгөж сая';
  }
  if (diff.inMinutes < 60) {
    return '${diff.inMinutes} минутын өмнө';
  }
  if (diff.inHours < 24) {
    return '${diff.inHours} цагийн өмнө';
  }
  return '${diff.inDays} хоногийн өмнө';
}
