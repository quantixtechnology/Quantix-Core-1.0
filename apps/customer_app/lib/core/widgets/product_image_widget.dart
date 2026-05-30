// ============================================================================
// ProductImageWidget — shared image renderer for all product surfaces.
//
// Rendering behaviour:
//   • BoxFit.contain    — never crops; shows the full product shape
//   • White background  — clean container, no colour bleed
//   • Padding           — breathing room around the image
//   • CachedNetworkImage — disk/memory cache, no repeat downloads
//   • Shimmer loading   — matches the app's skeleton UI pattern
//   • Fade-in           — smooth opacity transition when image is ready
//   • Retry button      — tappable error state; re-attempts the load
//   • Config param      — accepts ProductImageConfig; no magic numbers
//
// Usage (defaults from platform config):
//   ProductImageWidget(imageUrl: product.images.firstOrNull)
//
// Usage (explicit size):
//   ProductImageWidget(imageUrl: url, width: 64, height: 64)
//
// Usage (business override):
//   ProductImageWidget(imageUrl: url, config: storeImageConfig)
// ============================================================================

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../config/product_image_config.dart';

class ProductImageWidget extends StatelessWidget {
  const ProductImageWidget({
    super.key,
    required this.imageUrl,
    this.width,
    this.height,
    this.config,
    // Legacy explicit overrides — take priority over config when provided
    this.fit,
    this.borderRadius,
    this.padding,
    this.fallbackEmoji,
    this.backgroundColor,
  });

  final String? imageUrl;
  final double? width;
  final double? height;

  /// Optional business/page config. Defaults to ProductImageConfig.platform.
  final ProductImageConfig? config;

  // ── Per-instance overrides (legacy / one-off call sites) ─────────────────
  final BoxFit? fit;
  final double? borderRadius;
  final EdgeInsets? padding;
  final String? fallbackEmoji;
  final Color? backgroundColor;

  @override
  Widget build(BuildContext context) {
    final cfg = config ?? ProductImageConfig.platform;

    final effectiveFit        = fit        ?? cfg.fit;
    final effectiveRadius     = BorderRadius.circular(borderRadius ?? cfg.borderRadius);
    final effectivePadding    = padding    ?? EdgeInsets.all(cfg.padding);
    final effectiveEmoji      = fallbackEmoji  ?? cfg.fallbackEmoji;
    final effectiveBg         = backgroundColor ?? cfg.backgroundColor;

    if (imageUrl == null || imageUrl!.isEmpty) {
      return _Placeholder(
        width: width,
        height: height,
        borderRadius: effectiveRadius,
        emoji: effectiveEmoji,
      );
    }

    return ClipRRect(
      borderRadius: effectiveRadius,
      child: Container(
        width: width,
        height: height,
        color: effectiveBg,
        padding: effectivePadding,
        child: CachedNetworkImage(
          imageUrl: imageUrl!,
          fit: effectiveFit,
          // Shimmer while the first byte hasn't arrived yet
          placeholder: (_, _) => _Shimmer(width: width, height: height),
          // Smooth opacity fade-in when the image is decoded
          imageBuilder: (_, imageProvider) => _FadeImage(
            imageProvider: imageProvider,
            fit: effectiveFit,
          ),
          // Tappable retry on error
          errorWidget: (context, url, error) => _RetryPlaceholder(
            width: width,
            height: height,
            borderRadius: effectiveRadius,
            emoji: effectiveEmoji,
            onRetry: () {
              CachedNetworkImage.evictFromCache(url);
            },
          ),
        ),
      ),
    );
  }
}

// ── Shimmer loading skeleton ──────────────────────────────────────────────────

class _Shimmer extends StatelessWidget {
  const _Shimmer({this.width, this.height});

  final double? width;
  final double? height;

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: Colors.grey.shade200,
      highlightColor: Colors.grey.shade50,
      child: Container(
        width: width,
        height: height,
        color: Colors.white,
      ),
    );
  }
}

// ── Fade-in image ─────────────────────────────────────────────────────────────

class _FadeImage extends StatefulWidget {
  const _FadeImage({required this.imageProvider, required this.fit});

  final ImageProvider imageProvider;
  final BoxFit fit;

  @override
  State<_FadeImage> createState() => _FadeImageState();
}

class _FadeImageState extends State<_FadeImage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    )..forward();
    _opacity = CurvedAnimation(parent: _ctrl, curve: Curves.easeIn);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _opacity,
      child: Image(
        image: widget.imageProvider,
        fit: widget.fit,
      ),
    );
  }
}

// ── Emoji placeholder ─────────────────────────────────────────────────────────

class _Placeholder extends StatelessWidget {
  const _Placeholder({
    this.width,
    this.height,
    required this.borderRadius,
    required this.emoji,
  });

  final double? width;
  final double? height;
  final BorderRadius borderRadius;
  final String emoji;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: borderRadius,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Colors.grey.shade100, Colors.grey.shade50],
          ),
        ),
        child: Center(
          child: Text(
            emoji,
            style: TextStyle(
              fontSize: (height != null && height! < 60) ? 18 : 36,
            ),
          ),
        ),
      ),
    );
  }
}

// ── Retry placeholder ─────────────────────────────────────────────────────────

class _RetryPlaceholder extends StatelessWidget {
  const _RetryPlaceholder({
    this.width,
    this.height,
    required this.borderRadius,
    required this.emoji,
    required this.onRetry,
  });

  final double? width;
  final double? height;
  final BorderRadius borderRadius;
  final String emoji;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: borderRadius,
      child: GestureDetector(
        onTap: onRetry,
        child: Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Colors.grey.shade100, Colors.grey.shade50],
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                emoji,
                style: TextStyle(
                  fontSize: (height != null && height! < 60) ? 18 : 32,
                ),
              ),
              if (height == null || height! >= 60) ...[
                const SizedBox(height: 4),
                Icon(
                  Icons.refresh,
                  size: 14,
                  color: Colors.grey.shade400,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
