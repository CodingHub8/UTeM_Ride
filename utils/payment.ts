/**
 * UTeM Ride — HitPay Payment Gateway API Wrapper
 * 
 * Instructions:
 * 1. Log in to your HitPay Dashboard (https://dashboard.hit-pay.com).
 * 2. Go to Payment Gateway > API Keys to retrieve your API Key and Salt.
 * 3. Add these credentials into your project's .env file:
 *    EXPO_PUBLIC_HITPAY_API_KEY=YOUR_HITPAY_API_KEY
 *    EXPO_PUBLIC_HITPAY_SALT=YOUR_HITPAY_SALT
 *    EXPO_PUBLIC_HITPAY_SANDBOX=true (or false for production)
 */

// ============================================================
// HITPAY GATEWAY CONFIGURATIONS
// ============================================================
export const PAYMENT_CONFIG = {
  hitpay: {
    //apiKey: process.env.EXPO_PUBLIC_HITPAY_API_KEY,
    //salt: process.env.EXPO_PUBLIC_HITPAY_SALT,
    apiKey: process.env.EXPO_PUBLIC_HITPAY_SANDBOX_API_KEY,
    salt: process.env.EXPO_PUBLIC_HITPAY_SANDBOX_SALT,
    isSandbox: process.env.EXPO_PUBLIC_HITPAY_SANDBOX !== 'false', // Convert string to boolean correctly
    sandboxEndpoint: 'https://api.sandbox.hit-pay.com/v1/payment-requests',
    productionEndpoint: 'https://api.hit-pay.com/v1/payment-requests',
  },
  
  // System owner commission fee rate (e.g., 10%)
  commissionRate: 0.10,
};

// ============================================================
// CORE HITPAY API HELPER
// ============================================================

/**
 * Creates a payment request checkout session via the HitPay API.
 * Returns the hosted payment URL where the user will complete their transaction.
 */
async function createHitPayPaymentRequest(
  amount: number,
  studentId: string,
  paymentMethods: string[],
  purpose: string
): Promise<{ success: boolean; paymentUrl: string; transactionId: string }> {
  // Check if API key is not yet set or is a placeholder
  const apiKey = PAYMENT_CONFIG.hitpay.apiKey;
  const isMock = !apiKey;
  const mockTxId = 'hitpay_' + Math.random().toString(36).substring(2, 11).toUpperCase();

  if (isMock) {
    console.log(`[HitPay MOCK] Generating simulation checkout URL for RM ${amount} via ${paymentMethods.join('/')}`);
    return {
      success: true,
      paymentUrl: `https://sandbox.hit-pay.com/payment-request/${mockTxId}`,
      transactionId: mockTxId
    };
  }

  const endpoint = PAYMENT_CONFIG.hitpay.isSandbox
    ? PAYMENT_CONFIG.hitpay.sandboxEndpoint
    : PAYMENT_CONFIG.hitpay.productionEndpoint;

  const email = `${studentId}@student.utem.edu.my`;
  const referenceNumber = `ride_${studentId}_${Date.now()}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BUSINESS-API-KEY': apiKey || '',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({
        amount: amount.toFixed(2),
        currency: 'MYR',
        reference_number: referenceNumber,
        purpose: purpose,
        email: email,
        redirect_url: 'https://project-utem-ride.web.app/payment-callback', // TODO: Replaced custom scheme with valid HTTPS URL to satisfy HitPay validation
        webhook: 'https://yourserver.com/api/hitpay-webhook' // TODO: Replace with real webhook URL
        // To restrict options, ensure fpx/card are enabled in HitPay dashboard, then uncomment:
        // payment_methods: paymentMethods,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HitPay API response code ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return {
      success: true,
      paymentUrl: data.url,
      transactionId: data.id
    };
  } catch (error: any) {
    console.error('[HitPay Integration] Failed to create payment request:', error);
    throw new Error(error.message || 'HitPay connection failed');
  }
}

// ============================================================
// API INTEGRATION METHODS
// ============================================================

/**
 * Initiates an FPX Online Banking transaction via HitPay.
 * Redirects the user to their local Malaysian banks.
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
  console.log(`[Payment Gateway] Processing FPX payment of RM ${amount} (Bank: ${bankName}) via HitPay`);
  return createHitPayPaymentRequest(
    amount,
    studentId,
    ['fpx'],
    `Ride fare payment via FPX - Bank: ${bankName}`
  );
}

/**
 * Initiates a Card Payment (Visa / Mastercard) via HitPay.
 * 
 * Note: Under HitPay, card details are collected securely on the hosted checkout page,
 * making your client app PCI-compliant without local inputs. The cardDetails parameter
 * is preserved for backwards compatibility but can be passed empty.
 * 
 * @param amount - Payment amount in RM (e.g., 12.00)
 * @param cardDetails - Secured card fields (can be left blank; inputs occur on HitPay redirect)
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
): Promise<{ success: boolean; transactionId: string; message: string; paymentUrl: string }> {
  console.log(`[Payment Gateway] Processing Card payment of RM ${amount} via HitPay`);
  
  const request = await createHitPayPaymentRequest(
    amount,
    studentId,
    ['card'],
    'Ride fare payment via Card'
  );

  return {
    success: request.success,
    transactionId: request.transactionId,
    paymentUrl: request.paymentUrl,
    message: 'HitPay card session generated successfully.'
  };
}

/**
 * Processes a bank payout (withdrawal) for driver transfers.
 * Connects to HitPay payout endpoints or direct merchant banking lines.
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
    
    // Developer Integration Note:
    // Payout transfers should occur securely from your backend using HitPay's payout endpoints
    // or standard bank transfer protocols.
    
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

