import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { stripUndefined } from '@/utils/firestoreHelpers';
import { Alert } from 'react-native';
import { initiateFPXPayment, initiateCardPayment, PAYMENT_CONFIG } from '@/utils/payment';
import { waitForHitPayReturn } from '@/utils/paymentReturn';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'cancelled';
export type PaymentContext = 'ride' | 'pool_booking' | 'wallet_topup';

export interface PaymentRecord {
  user_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_label: string;
  hitpay_id: string;
  status: PaymentStatus;
  context: PaymentContext;
  context_id?: string;
  purpose: string;
  created_at?: unknown;
  completed_at?: unknown;
}

export async function createPaymentRecord(input: Omit<PaymentRecord, 'status' | 'currency' | 'created_at' | 'completed_at'> & { status?: PaymentStatus }) {
  const ref = await addDoc(collection(db, 'payments'), stripUndefined({
    ...input,
    currency: 'MYR',
    status: input.status || 'pending',
    created_at: serverTimestamp(),
  }));
  return ref.id;
}

export async function updatePaymentStatus(paymentId: string, status: PaymentStatus) {
  const ref = doc(db, 'payments', paymentId);
  const patch: Record<string, unknown> = { status, updated_at: serverTimestamp() };
  if (status === 'completed') patch.completed_at = serverTimestamp();
  await updateDoc(ref, patch);
}

export async function getPaymentRecord(paymentId: string) {
  const snap = await getDoc(doc(db, 'payments', paymentId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as PaymentRecord) };
}

export function parseAmount(value: string | number | undefined | null): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const n = parseFloat(String(value).replace(/[^\d.]/g, ''));
  return isNaN(n) ? 0 : n;
}

export async function processHitPayCheckout(input: {
  amount: number;
  userId: string;
  userEmail: string;
  userName?: string;
  paymentMethod: 'fpx' | 'card';
  paymentLabel: string;
  bankName?: string;
  cardDetails?: { cardNumber: string; cardName: string; cardExpiry: string; cardCvv: string };
  context: PaymentContext;
  contextId?: string;
  purpose: string;
}): Promise<{ success: boolean; paymentId: string; hitpayId: string }> {
  const payer = {
    email: input.userEmail,
    name: input.userName,
    referenceId: input.userId,
  };

  let hitpayResult;
  if (input.paymentMethod === 'fpx') {
    hitpayResult = await initiateFPXPayment(input.amount, input.bankName || 'Maybank2u', payer);
  } else {
    hitpayResult = await initiateCardPayment(
      input.amount,
      input.cardDetails || { cardNumber: '', cardName: '', cardExpiry: '', cardCvv: '' },
      payer
    );
  }

  if (!hitpayResult.success || !hitpayResult.paymentUrl) {
    throw new Error('Failed to create HitPay payment session.');
  }

  const paymentId = await createPaymentRecord({
    user_id: input.userId,
    amount: input.amount,
    payment_method: input.paymentMethod,
    payment_label: input.paymentLabel,
    hitpay_id: hitpayResult.transactionId,
    context: input.context,
    context_id: input.contextId,
    purpose: input.purpose,
    status: 'pending',
  });

  if (PAYMENT_CONFIG.hitpay.devSimulate) {
    return new Promise((resolve) => {
      Alert.alert(
        'Sandbox Payment',
        `HitPay session created (ID: ${hitpayResult.transactionId.slice(0, 8)}…).\n\nTouch 'n Go / DuitNow do not work in HitPay sandbox and show "Unknown error".\n\nSimulate a successful payment for testing?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: async () => {
              await updatePaymentStatus(paymentId, 'cancelled');
              resolve({ success: false, paymentId, hitpayId: hitpayResult.transactionId });
            },
          },
          {
            text: 'Simulate paid',
            onPress: async () => {
              await updatePaymentStatus(paymentId, 'completed');
              resolve({ success: true, paymentId, hitpayId: hitpayResult.transactionId });
            },
          },
        ]
      );
    });
  }

  const result = await waitForHitPayReturn({
    paymentId,
    hitpayId: hitpayResult.transactionId,
    checkoutUrl: hitpayResult.paymentUrl,
  });

  await updatePaymentStatus(paymentId, result.success ? 'completed' : 'failed');
  return result;
}
