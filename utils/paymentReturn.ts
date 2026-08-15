import React, { useState, useEffect } from 'react';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import PaymentWebViewModal from '@/components/PaymentWebViewModal';

export interface PaymentCheckoutResult {
  success: boolean;
  paymentId: string;
  hitpayId?: string;
  error?: string;
}

type PaymentHandler = (status: 'completed' | 'failed' | 'cancelled') => void;

let globalShowPaymentModal: ((url: string, callback: PaymentHandler) => void) | null = null;

/**
 * Global component rendered in _layout.tsx to display embedded WebView checkout modals.
 */
export function GlobalPaymentWebView() {
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [callback, setCallback] = useState<PaymentHandler | null>(null);

  useEffect(() => {
    globalShowPaymentModal = (checkoutUrl, onComplete) => {
      console.log('[GlobalPaymentWebView] Opening embedded WebView modal for:', checkoutUrl);
      setUrl(checkoutUrl);
      setCallback(() => onComplete);
      setVisible(true);
    };
    return () => {
      globalShowPaymentModal = null;
    };
  }, []);

  const handleClose = (status: 'completed' | 'failed' | 'cancelled') => {
    console.log('[GlobalPaymentWebView] Modal closed with status:', status);
    setVisible(false);
    setUrl(null);
    if (callback) {
      callback(status);
      setCallback(null);
    }
  };

  return React.createElement(PaymentWebViewModal, { visible, paymentUrl: url, onClose: handleClose });
}

/**
 * Strict Firestore verification helper to check if payment was completed server-side
 */
export async function checkFirestorePaymentCompleted(paymentId: string): Promise<boolean> {
  try {
    const payRef = doc(db, 'payments', paymentId);
    const snap = await getDoc(payRef);
    if (snap.exists()) {
      const data = snap.data();
      return data.status === 'completed';
    }
  } catch (err) {
    console.warn('[checkFirestorePaymentCompleted] Error checking payment doc:', err);
  }
  return false;
}

/**
 * Waits for HitPay payment completion using either embedded WebView modal or WebBrowser auth session.
 */
export async function waitForHitPayReturn(input: {
  paymentId: string;
  hitpayId: string;
  checkoutUrl: string;
}): Promise<PaymentCheckoutResult> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: PaymentCheckoutResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    if (globalShowPaymentModal) {
      globalShowPaymentModal(input.checkoutUrl, async (status) => {
        if (status === 'completed') {
          // Double-check Firestore if needed or resolve directly
          finish({ success: true, paymentId: input.paymentId, hitpayId: input.hitpayId });
        } else {
          finish({ success: false, paymentId: input.paymentId, hitpayId: input.hitpayId });
        }
      });
    } else {
      // WebBrowser fallback if component is not mounted
      const redirectSuccessUrl = 'https://project-utem-ride.web.app/payment-success.html';
      WebBrowser.openAuthSessionAsync(input.checkoutUrl, redirectSuccessUrl)
        .then(async (authResult) => {
          if (settled) return;

          if (authResult.type === 'success' && authResult.url) {
            const isFailedUrl =
              authResult.url.includes('payment-failed') ||
              authResult.url.includes('status=failed') ||
              authResult.url.includes('status=cancelled');
            if (isFailedUrl) {
              finish({ success: false, paymentId: input.paymentId, hitpayId: input.hitpayId });
              return;
            }
            const isSuccessUrl =
              authResult.url.includes('payment-success') || authResult.url.includes('status=completed');
            if (isSuccessUrl) {
              finish({ success: true, paymentId: input.paymentId, hitpayId: input.hitpayId });
              return;
            }
          }

          const isVerified = await checkFirestorePaymentCompleted(input.paymentId);
          finish({ success: isVerified, paymentId: input.paymentId, hitpayId: input.hitpayId });
        })
        .catch(async () => {
          const isVerified = await checkFirestorePaymentCompleted(input.paymentId);
          finish({ success: isVerified, paymentId: input.paymentId, hitpayId: input.hitpayId });
        });
    }
  });
}

export async function fulfillPaymentFromDeepLink(urlStr: string): Promise<boolean> {
  return true;
}
