// ============================================================================
// ImageUrlUtils — mirrors src/lib/image-url.ts for Flutter.
//
// The backend stores image paths as relative `/uploads/...` paths.
// The Next.js server rewrites these to `/api/core/files/...` at the web
// layer, but Flutter needs absolute URLs.  This utility performs the same
// resolution so all mobile screens use a consistent, correct image URL.
//
// Resolution rules (same order as the web resolver):
//   1. Already absolute (http/https/data:) → return as-is
//   2. /uploads/…  → {baseUrl}/api/core/files/…
//   3. uploads/…   → {baseUrl}/api/core/files/…
//   4. /…          → {baseUrl}/…
//   5. null / ""   → null  (callers can show a placeholder)
// ============================================================================

import '../config/app_config.dart';

class ImageUrlUtils {
  ImageUrlUtils._();

  static String? resolve(String? raw) {
    if (raw == null || raw.isEmpty) return null;

    // Already absolute
    if (raw.startsWith('http://') ||
        raw.startsWith('https://') ||
        raw.startsWith('data:')) {
      return raw;
    }

    const base = AppConfig.baseUrl;

    if (raw.startsWith('/uploads/')) {
      return '$base/api/core/files/${raw.substring('/uploads/'.length)}';
    }
    if (raw.startsWith('uploads/')) {
      return '$base/api/core/files/${raw.substring('uploads/'.length)}';
    }
    if (raw.startsWith('/')) {
      return '$base$raw';
    }

    return '$base/$raw';
  }

  /// Resolves a list and strips nulls — useful for product image arrays.
  static List<String> resolveAll(List<String?>? raws) {
    if (raws == null) return [];
    return raws
        .map(resolve)
        .whereType<String>()
        .toList();
  }
}
