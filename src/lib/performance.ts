/**
 * Performance optimization utilities for Quantix Core Platform v2.0
 * Provides debounce, throttle, lazy loading, measurement, virtual scrolling, and prefetch helpers.
 */

/**
 * Debounce utility - delays function execution until after a period of inactivity.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: unknown[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, ms);
  };

  return debounced as T;
}

/**
 * Throttle utility - limits function execution to at most once per interval.
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): T {
  let lastCallTime = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const throttled = (...args: unknown[]) => {
    const now = Date.now();
    const elapsed = now - lastCallTime;

    if (elapsed >= ms) {
      lastCallTime = now;
      fn(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(
        () => {
          lastCallTime = Date.now();
          timeoutId = null;
          fn(...args);
        },
        ms - elapsed
      );
    }
  };

  return throttled as T;
}

/**
 * Lazy load an image by creating an Image object and waiting for it to load.
 * Returns the src on successful load.
 */
export function lazyLoadImage(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(src);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
  });
}

/**
 * Measure the execution time of a function using the Performance API.
 * Logs the result to the console with the provided name.
 */
export function measurePerformance(name: string, fn: () => void): void {
  if (typeof performance !== "undefined") {
    const startMark = `${name}-start`;
    const endMark = `${name}-end`;

    performance.mark(startMark);
    fn();
    performance.mark(endMark);

    performance.measure(name, startMark, endMark);

    const measures = performance.getEntriesByName(name);
    const lastMeasure = measures[measures.length - 1];

    if (lastMeasure) {
      console.log(`[Perf] ${name}: ${lastMeasure.duration.toFixed(2)}ms`);
    }

    // Clean up marks and measures to avoid memory leaks
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(name);
  } else {
    fn();
  }
}

/**
 * Memory-efficient list rendering - returns visible items for virtual scrolling.
 * Calculates which items are visible in a scrollable container based on scroll position,
 * item height, container height, and an optional overscan count.
 */
export function getVisibleItems<T>(
  items: T[],
  scrollTop: number,
  itemHeight: number,
  containerHeight: number,
  overscan: number = 3
): T[] {
  if (items.length === 0 || itemHeight <= 0 || containerHeight <= 0) {
    return [];
  }

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  return items.slice(startIndex, endIndex);
}

/**
 * Prefetch data on hover or touch start.
 * Returns event handler props that can be spread onto an element.
 */
export function prefetchOnHover(callback: () => void): {
  onMouseEnter: () => void;
  onTouchStart: () => void;
} {
  let prefetched = false;

  const prefetch = () => {
    if (!prefetched) {
      prefetched = true;
      callback();
    }
  };

  return {
    onMouseEnter: prefetch,
    onTouchStart: prefetch,
  };
}
