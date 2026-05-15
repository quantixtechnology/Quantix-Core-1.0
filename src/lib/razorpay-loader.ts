// ============================================================================
// QUANTIX CORE — Razorpay Checkout Script Loader
// Dynamically loads the Razorpay checkout.js script on the client side
// Provides utilities to check loading state and get the global instance
// ============================================================================

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
const RAZORPAY_GLOBAL_KEY = 'Razorpay';

let scriptLoadPromise: Promise<boolean> | null = null;

/**
 * Load the Razorpay checkout script dynamically.
 * Returns a promise that resolves to `true` if the script loaded successfully,
 * or `false` if it failed.
 * Ensures the script is only loaded once even if called multiple times.
 */
export function loadRazorpayScript(): Promise<boolean> {
  // If already loaded, resolve immediately
  if (isRazorpayLoaded()) {
    return Promise.resolve(true);
  }

  // If a load is already in progress, return the existing promise
  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise<boolean>((resolve) => {
    // Check if script tag already exists in DOM
    const existingScript = document.querySelector(
      `script[src="${RAZORPAY_SCRIPT_URL}"]`
    );

    if (existingScript) {
      // Script tag exists, wait for it to load
      existingScript.addEventListener('load', () => resolve(isRazorpayLoaded()));
      existingScript.addEventListener('error', () => {
        scriptLoadPromise = null;
        resolve(false);
      });
      return;
    }

    // Create and append the script tag
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.crossOrigin = 'anonymous';

    script.addEventListener('load', () => {
      const loaded = isRazorpayLoaded();
      if (!loaded) {
        scriptLoadPromise = null;
      }
      resolve(loaded);
    });

    script.addEventListener('error', () => {
      scriptLoadPromise = null;
      resolve(false);
    });

    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

/**
 * Check if the Razorpay checkout script has been loaded
 * and the global Razorpay constructor is available.
 */
export function isRazorpayLoaded(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof (window as unknown as Record<string, unknown>)[RAZORPAY_GLOBAL_KEY] !== 'undefined';
}

/**
 * Get the global Razorpay constructor if available.
 * Returns `null` if the script hasn't been loaded yet.
 */
export function getRazorpayInstance(): unknown {
  if (typeof window === 'undefined') return null;
  return (window as unknown as Record<string, unknown>)[RAZORPAY_GLOBAL_KEY] || null;
}
