/**
 * UTeM Ride — Payment Gateway API Wrapper
 * 
 * Instructions:
 * 1. Replace the placeholder constants below with your actual merchant credentials.
 * 2. Configure your server endpoints/webhooks to handle payment completion events.
 * 3. Integrate these methods with your front-end payment confirmation steps.
 */

// ============================================================
// PAYMENT GATEWAY CONFIGURATIONS (TO BE PROVIDED BY DEVELOPER)
// ============================================================
export const PAYMENT_CONFIG = {
  // 1. FPX Online Banking Configuration (e.g., ToyyibPay / Billplz / SenangPay)
  fpx: {
    apiEndpoint: 'https://toyyibpay.com/api/', // Change to staging or production URL
    secretKey: 'YOUR_TOYYIBPAY_SECRET_KEY',     // Enter your ToyyibPay Secret Key
    categoryCode: 'YOUR_CATEGORY_CODE',         // Enter your Category Code
  },

  // 2. Card Payments Configuration (e.g., Stripe / Adyen / Braintree)
  card: {
    publishableKey: 'pk_test_YOUR_STRIPE_KEY',  // Enter Stripe Publishable Key
    secretKey: 'sk_test_YOUR_STRIPE_SECRET',    // Enter Stripe Secret Key (for server use)
    merchantIdentifier: 'merchant.utemride',    // Apple/Google Pay merchant identifier
  },

  // 3. System owner commission fee rate (e.g., 10%)
  commissionRate: 0.10,
};

// ============================================================
// API INTEGRATION METHODS
// ============================================================

/**
 * Initiates an FPX Online Banking transaction.
 * Usually requests a checkout URL from the payment gateway (like ToyyibPay or Billplz)
 * which redirects the user to their online banking portal.
 * 
 * @param amount - Payment amount in RM (e.g., 5.50)
 * @param bankName - Selected bank identifier (e.g., 'Maybank2u', 'CIMB Clicks')
 * @param studentId - Matric ID of the paying passenger
 */
export async function initiateFPXPayment(
  amount: number,
  bankName: string,
  studentId: string
): Promise<{ success: boolean; paymentUrl: string; transactionId: string }> {
  try {
    console.log(`[Payment Gateway] Initiating FPX payment of RM ${amount} via ${bankName} for user ${studentId}`);
    
    // Developer Integration Todo:
    // Make a POST request to your backend or directly to the gateway API:
    /*
    const response = await fetch(`${PAYMENT_CONFIG.fpx.apiEndpoint}createBill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userSecretKey: PAYMENT_CONFIG.fpx.secretKey,
        billName: `Ride Payment - ${studentId}`,
        billDescription: `Ride Fare payment of RM ${amount}`,
        billPriceSetting: 1,
        billPayorInfo: 1,
        billAmount: amount * 100, // convert to cents
        billReturnUrl: 'utemride://payment-callback',
        billCallbackUrl: 'https://yourserver.com/api/payment-webhook',
        billCategoryCode: PAYMENT_CONFIG.fpx.categoryCode,
      })
    });
    const data = await response.json();
    if (data.status === 'success') {
      return { success: true, paymentUrl: data.billUrl, transactionId: data.billCode };
    }
    */

    // Simulated response for development:
    const mockTxId = 'fpx_' + Math.random().toString(36).substring(2, 11).toUpperCase();
    return {
      success: true,
      paymentUrl: `https://sandbox.toyyibpay.com/bill/${mockTxId}`, // Sandbox bank redirection
      transactionId: mockTxId
    };
  } catch (error) {
    console.error('FPX Payment initiation error:', error);
    throw error;
  }
}

/**
 * Initiates a Card Payment (Visa / Mastercard) using a gateway like Stripe.
 * Creates a payment intent and returns the payment authorization status.
 * 
 * @param amount - Payment amount in RM (e.g., 12.00)
 * @param cardDetails - Secured card fields parsed from the confirmation view
 * @param studentId - Matric ID of the paying passenger
 */
export async function initiateCardPayment(
  amount: number,
  cardDetails: {
    cardNumber: string;
    cardName: string;
    cardExpiry: string;
    cardCvv: string;
  },
  studentId: string
): Promise<{ success: boolean; transactionId: string; message: string }> {
  try {
    console.log(`[Payment Gateway] Processing Card transaction of RM ${amount} for user ${studentId}`);
    
    // Developer Integration Todo (Stripe PaymentIntent flow):
    // 1. Create a PaymentIntent on your backend server.
    // 2. Confirm the payment on the mobile client using @stripe/stripe-react-native.
    /*
    const response = await fetch('https://yourserver.com/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amount * 100, currency: 'myr', studentId })
    });
    const { clientSecret } = await response.json();
    const { paymentIntent, error } = await confirmPayment(clientSecret, {
      paymentMethodType: 'Card',
      paymentMethodData: {
        billingDetails: { name: cardDetails.cardName },
      }
    });
    if (paymentIntent) {
      return { success: true, transactionId: paymentIntent.id, message: 'Payment Approved' };
    }
    */

    // Simulated response for development:
    const mockTxId = 'ch_' + Math.random().toString(36).substring(2, 11).toUpperCase();
    return {
      success: true,
      transactionId: mockTxId,
      message: 'Card authorized successfully via secure Stripe placeholder.'
    };
  } catch (error) {
    console.error('Card Payment processing error:', error);
    throw error;
  }
}

/**
 * Processes a bank payout (withdrawal) using instant transfer gateway nodes.
 * 
 * @param amount - Payout amount in RM
 * @param bankDetails - Target driver bank account configurations
 */
export async function processBankPayout(
  amount: number,
  bankDetails: {
    bankName: string;
    accountNumber: string;
  }
): Promise<{ success: boolean; transactionId: string }> {
  try {
    console.log(`[Payment Gateway] Processing instant withdrawal of RM ${amount} to ${bankDetails.bankName} (${bankDetails.accountNumber})`);
    
    // Developer Integration Todo:
    // Connect to your commercial banking API or Stripe Connect payout nodes.
    
    const mockTxId = 'wd_' + Math.random().toString(36).substring(2, 11).toUpperCase();
    return {
      success: true,
      transactionId: mockTxId
    };
  } catch (error) {
    console.error('Bank withdrawal payout error:', error);
    throw error;
  }
}
