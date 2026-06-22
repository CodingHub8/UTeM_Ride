import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';

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

    void WebBrowser.openBrowserAsync(input.checkoutUrl, {
      showInRecents: false,
      enableBarCollapsing: true,
    }).then((browserResult) => {
      if (settled) return;
      clearPaymentWaiter();

      if (browserResult.type === 'cancel' || browserResult.type === 'dismiss') {
        Alert.alert(
          'Payment',
          'Did you finish paying on HitPay?',
          [
            {
              text: 'No',
              style: 'cancel',
              onPress: () => finish({ success: false, paymentId: input.paymentId, hitpayId: input.hitpayId }),
            },
            {
              text: 'Yes, paid',
              onPress: () => finish({ success: true, paymentId: input.paymentId, hitpayId: input.hitpayId }),
            },
          ]
        );
        return;
      }

      finish({ success: false, paymentId: input.paymentId, hitpayId: input.hitpayId });
    });
  });
}
