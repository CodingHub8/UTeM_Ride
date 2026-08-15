import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/utils/firebase';

export type PaymentCheckoutResult = {
  success: boolean;
  paymentId: string;
  hitpayId: string;
};

type PaymentWaiter = {
  paymentId: string;
  hitpayId: string;
  resolve: (result: PaymentCheckoutResult) => void;
};

let activeWaiter: PaymentWaiter | null = null;
let linkingSub: { remove: () => void } | null = null;

function parsePaymentReturnUrl(url: string): { status: string; reference: string } {
  const parsed = Linking.parse(url);
  const status = String(parsed.queryParams?.status ?? '');
  const reference = String(parsed.queryParams?.reference ?? '');
  return { status, reference };
}

function settleWaiter(success: boolean) {
  if (!activeWaiter) return null;
  const { paymentId, hitpayId, resolve } = activeWaiter;
  clearPaymentWaiter();
  const result = { success, paymentId, hitpayId };
  resolve(result);
  return result;
}

export function clearPaymentWaiter() {
  activeWaiter = null;
  linkingSub?.remove();
  linkingSub = null;
}

export async function fulfillPaymentFromDeepLink(url: string): Promise<PaymentCheckoutResult | null> {
  if (!activeWaiter) return null;

  try {
    await WebBrowser.dismissBrowser();
  } catch {
    // browser may already be closed
  }

  const { status } = parsePaymentReturnUrl(url);
  if (status === 'failed' || status === 'cancelled') {
    return settleWaiter(false);
  }
  return settleWaiter(true);
}

/** Verifies that the payment has actually been recorded as completed in Firestore */
async function checkFirestorePaymentCompleted(paymentId: string): Promise<boolean> {
  try {
    const payDoc = await getDoc(doc(db, 'payments', paymentId));
    if (payDoc.exists()) {
      return payDoc.data()?.status === 'completed';
    }
  } catch (err) {
    console.warn('[PaymentVerification] Firestore lookup notice:', err);
  }
  return false;
}

export async function waitForHitPayReturn(input: {
  paymentId: string;
  hitpayId: string;
  checkoutUrl: string;
}): Promise<PaymentCheckoutResult> {
  WebBrowser.maybeCompleteAuthSession();

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: PaymentCheckoutResult) => {
      if (settled) return;
      settled = true;
      clearPaymentWaiter();
      resolve(result);
    };

    activeWaiter = {
      paymentId: input.paymentId,
      hitpayId: input.hitpayId,
      resolve: finish,
    };

    linkingSub = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('payment-complete')) {
        void fulfillPaymentFromDeepLink(url);
      }
    });

    const redirectUrl = 'https://project-utem-ride.web.app/payment-success.html';

    WebBrowser.openAuthSessionAsync(input.checkoutUrl, redirectUrl)
      .then(async (authResult) => {
        if (settled) return;
        clearPaymentWaiter();

        if (authResult.type === 'success' && authResult.url) {
          const isFailedUrl = authResult.url.includes('payment-failed') || 
                              authResult.url.includes('status=failed') || 
                              authResult.url.includes('status=cancelled');
          if (isFailedUrl) {
            finish({ success: false, paymentId: input.paymentId, hitpayId: input.hitpayId });
            return;
          }
          const isSuccessUrl = authResult.url.includes('payment-success') || authResult.url.includes('status=completed');
          if (isSuccessUrl) {
            finish({ success: true, paymentId: input.paymentId, hitpayId: input.hitpayId });
            return;
          }
        }

        // Strict verification fallback: check if Firestore document was updated to 'completed'
        const isVerified = await checkFirestorePaymentCompleted(input.paymentId);
        finish({ success: isVerified, paymentId: input.paymentId, hitpayId: input.hitpayId });
      })
      .catch(async (err) => {
        console.warn('[WebBrowser AuthSession] Fallback to openBrowserAsync:', err);
        await WebBrowser.openBrowserAsync(input.checkoutUrl, { showInRecents: false });
        if (settled) return;
        clearPaymentWaiter();

        const isVerified = await checkFirestorePaymentCompleted(input.paymentId);
        finish({ success: isVerified, paymentId: input.paymentId, hitpayId: input.hitpayId });
      });
  });
}
