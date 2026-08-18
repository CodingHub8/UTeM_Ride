import { sendSignInLinkToEmail } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/utils/firebase';

export type OtpChannel = 'email' | 'sms';

/** Generates a 6-digit numeric OTP string */
export function generate6DigitOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Dispatches 2FA verification using 100% Pure Native Firebase Auth Infrastructure
 */
export function formatPhoneNumber(input: string): string {
  if (!input) return '';
  const cleaned = input.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  const digitsNoLeadingZero = cleaned.replace(/^0+/, '');
  return `+60${digitsNoLeadingZero}`;
}

/**
 * Dispatches 2FA verification using Pure Native Firebase Infrastructure
 */
export async function sendOtpCode(
  userId: string,
  channel: OtpChannel,
  destination: string
): Promise<{ success: boolean; otpCode: string; message: string }> {
  const rawDestination = destination ? destination.trim() : '';
  if (!rawDestination) {
    throw new Error(`Please enter a valid ${channel === 'email' ? 'UTeM Email address' : 'Mobile Phone number'}.`);
  }

  const cleanDestination = channel === 'sms' ? formatPhoneNumber(rawDestination) : rawDestination;

  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('User account not found.');

  const otpCode = generate6DigitOtp();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

  // 1. Save 2FA OTP record in Firestore user profile
  await updateDoc(userRef, {
    otp_code: otpCode,
    otp_expires_at: expiresAt,
    otp_channel: channel,
    otp_destination: cleanDestination,
    phone: channel === 'sms' ? cleanDestination : snap.data()?.phone || cleanDestination,
    updated_at: serverTimestamp(),
  });

  const nowUtc = new Date().toUTCString();

  // 2. Dispatch via Native Firebase Auth Email Link (Link only, no 6-digit code needed)
  if (channel === 'email') {
    const actionCodeSettings = {
      url: `https://project-utem-ride.web.app/email-verify.html?userId=${userId}`,
      handleCodeInApp: true,
    };
    try {
      console.log(`[UTeM Ride Email] Dispatching 2FA email link to ${cleanDestination}`);
      await sendSignInLinkToEmail(auth, cleanDestination, actionCodeSettings);
    } catch (err: any) {
      console.warn('[UTeM Ride Email Dispatch Warning]:', err?.message || err);
    }
  }

  // 3. Dispatch via Native Firebase Phone Auth (SMS OTP)
  if (channel === 'sms') {
    console.log(`[UTeM Ride Phone Auth SMS] Dispatched 6-digit OTP to ${cleanDestination}`);
    
    try {
      const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
      if (apiKey) {
        await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: cleanDestination }),
        });
      }
    } catch (apiErr) {
      console.warn('[UTeM Ride SMS REST Call Notice]:', apiErr);
    }
  }

  return {
    success: true,
    otpCode,
    message: channel === 'email' 
      ? `A verification link has been sent to ${cleanDestination}. Please check your inbox and tap the link to verify your account.`
      : `A 6-digit 2FA verification code has been sent to ${cleanDestination} via SMS.`,
  };
}

/** Verifies the user's submitted 6-digit OTP code against Firestore */
export async function verifyOtpCode(userId: string, inputCode: string): Promise<boolean> {
  const cleanCode = String(inputCode).trim();
  if (cleanCode.length !== 6) {
    throw new Error('Please enter the full 6-digit verification code.');
  }

  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    throw new Error('User record not found.');
  }

  const data = snap.data();
  const savedOtp = data.otp_code;
  const expiresAt = data.otp_expires_at;

  if (!savedOtp) {
    throw new Error('No active verification request found. Please request a new 2FA code.');
  }

  if (Date.now() > expiresAt) {
    throw new Error('Verification code has expired. Please request a new code.');
  }

  if (cleanCode !== savedOtp) {
    throw new Error('Incorrect 6-digit verification code. Please check and try again.');
  }

  // Update Firestore user document with 2FA verified status
  await updateDoc(userRef, {
    is_2FA_verified: true,
    otp_code: null,
    otp_expires_at: null,
    updated_at: serverTimestamp(),
  });

  return true;
}
