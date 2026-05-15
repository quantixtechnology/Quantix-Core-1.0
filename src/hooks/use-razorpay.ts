'use client';

// ============================================================================
// QUANTIX CORE — Razorpay Checkout Hook
// Comprehensive hook for Razorpay checkout on the frontend
// Handles: script loading, order creation, modal opening, verification
// Supports both real Razorpay and mock mode
// ============================================================================

import { useState, useCallback, useRef } from 'react';
import { loadRazorpayScript, getRazorpayInstance } from '@/lib/razorpay-loader';
import { showSuccess, showError, showWarning, showLoading, dismissToast } from '@/lib/toast-utils';

// ============================================================================
// TYPES
// ============================================================================

export interface RazorpayCheckoutOptions {
  /** Internal order ID */
  orderId: string;
  /** Amount in rupees (will be converted to paise for Razorpay) */
  amount: number;
  /** Currency code (default: INR) */
  currency?: string;
  /** Customer name for prefill */
  customerName?: string;
  /** Customer email for prefill */
  customerEmail?: string;
  /** Customer phone for prefill */
  customerPhone?: string;
  /** Callback on successful payment */
  onSuccess?: (paymentId: string, orderId: string) => void;
  /** Callback on payment failure */
  onFailure?: (error: string) => void;
}

export interface RazorpayCheckoutResult {
  /** Trigger the checkout flow */
  checkout: (options: RazorpayCheckoutOptions) => Promise<void>;
  /** Whether checkout is currently processing */
  isProcessing: boolean;
  /** Last error message */
  error: string | null;
}

interface RazorpayOrderResponse {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  key: string;
  isMock: boolean;
}

interface RazorpayVerifyResponse {
  paymentId: string;
  orderId: string;
  status: string;
  amount: number;
  currency: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      on: (event: string, handler: (response: Record<string, unknown>) => void) => void;
      open: () => void;
    };
  }
}

// ============================================================================
// HOOK
// ============================================================================

export function useRazorpayCheckout(): RazorpayCheckoutResult {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false);

  const checkout = useCallback(async (options: RazorpayCheckoutOptions) => {
    // Prevent double-invocation
    if (processingRef.current) {
      showWarning('Payment in progress', 'A payment is already being processed. Please wait.');
      return;
    }

    const {
      orderId,
      amount,
      currency = 'INR',
      customerName,
      customerEmail,
      customerPhone,
      onSuccess,
      onFailure,
    } = options;

    processingRef.current = true;
    setIsProcessing(true);
    setError(null);

    const loadingToast = showLoading('Processing payment', 'Setting up your payment...');

    try {
      // Step 1: Create Razorpay order via API
      const orderResponse = await fetch('/api/core/payments/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, amount, currency }),
      });

      const orderData = await orderResponse.json();

      if (!orderData.success) {
        throw new Error(orderData.error || 'Failed to create payment order');
      }

      const order: RazorpayOrderResponse = orderData.data;

      dismissToast(loadingToast);

      // Step 2: If mock mode, auto-verify and return success
      if (order.isMock) {
        const verifyLoadingToast = showLoading('Verifying payment', 'Confirming your payment...');

        try {
          const verifyResponse = await fetch('/api/core/payments/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_payment_id: `pay_mock_${Date.now()}`,
              razorpay_order_id: order.razorpayOrderId,
              razorpay_signature: 'mock_signature',
              orderId,
            }),
          });

          const verifyData = await verifyResponse.json();

          dismissToast(verifyLoadingToast);

          if (verifyData.success) {
            showSuccess('Payment successful!', `₹${amount.toLocaleString('en-IN')} paid successfully`);
            onSuccess?.(verifyData.data.paymentId, orderId);
          } else {
            throw new Error(verifyData.error || 'Payment verification failed');
          }
        } catch (verifyErr) {
          dismissToast(verifyLoadingToast);
          const errMsg = verifyErr instanceof Error ? verifyErr.message : 'Payment verification failed';
          showError('Payment verification failed', errMsg);
          setError(errMsg);
          onFailure?.(errMsg);
        }

        return;
      }

      // Step 3: Load Razorpay script dynamically
      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded) {
        throw new Error('Failed to load Razorpay checkout. Please check your internet connection and try again.');
      }

      const RazorpayClass = getRazorpayInstance() as (new (options: Record<string, unknown>) => {
        on: (event: string, handler: (response: Record<string, unknown>) => void) => void;
        open: () => void;
      }) | null;
      if (!RazorpayClass) {
        throw new Error('Razorpay checkout is not available. Please refresh the page and try again.');
      }

      // Step 4: Open Razorpay checkout modal
      await new Promise<void>((resolve, reject) => {
        const razorpayOptions = {
          key: order.key,
          amount: Math.round(amount * 100), // Convert to paise
          currency: order.currency || currency,
          name: 'Quantix',
          description: `Payment for order ${orderId}`,
          order_id: order.razorpayOrderId,
          prefill: {
            name: customerName || '',
            email: customerEmail || '',
            contact: customerPhone || '',
          },
          theme: {
            color: '#10B981', // Emerald green matching Quantix brand
          },
          handler: async function (
            response: {
              razorpay_payment_id: string;
              razorpay_order_id: string;
              razorpay_signature: string;
            }
          ) {
            // Payment succeeded on Razorpay's end — now verify on backend
            const verifyLoading = showLoading('Verifying payment', 'Confirming your payment...');

            try {
              const verifyResponse = await fetch('/api/core/payments/razorpay/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                  orderId,
                }),
              });

              const verifyData = await verifyResponse.json();

              dismissToast(verifyLoading);

              if (verifyData.success) {
                showSuccess('Payment successful!', `₹${amount.toLocaleString('en-IN')} paid successfully`);
                onSuccess?.(response.razorpay_payment_id, orderId);
                resolve();
              } else {
                showError('Payment verification failed', verifyData.error || 'Please contact support.');
                setError(verifyData.error || 'Payment verification failed');
                onFailure?.(verifyData.error || 'Payment verification failed');
                reject(new Error(verifyData.error || 'Payment verification failed'));
              }
            } catch (verifyErr) {
              dismissToast(verifyLoading);
              const errMsg = verifyErr instanceof Error ? verifyErr.message : 'Payment verification failed';
              showError('Payment verification failed', errMsg);
              setError(errMsg);
              onFailure?.(errMsg);
              reject(verifyErr);
            }
          },
          modal: {
            ondismiss: function () {
              showWarning('Payment cancelled', 'You cancelled the payment. You can try again.');
              setError('Payment modal was closed');
              onFailure?.('Payment cancelled by user');
              reject(new Error('Payment cancelled by user'));
            },
          },
        };

        const rzp = new RazorpayClass(razorpayOptions);
        rzp.on('payment.failed', function (response: Record<string, unknown>) {
          const errPayload = response.error as { code: string; description: string; reason: string } | undefined;
          const errMsg = errPayload?.description || 'Payment failed';
          console.error('[Razorpay Checkout] Payment failed:', errPayload);
          showError('Payment failed', errMsg);
          setError(errMsg);
          onFailure?.(errMsg);
          reject(new Error(errMsg));
        });

        rzp.open();
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'An unexpected error occurred';
      showError('Payment error', errMsg);
      setError(errMsg);
      onFailure?.(errMsg);
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, []);

  return { checkout, isProcessing, error };
}
