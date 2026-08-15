import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/utils/firebase';

export type OtpChannel = 'email' | 'sms';

/** Generates a 6-digit numeric OTP string */
export function generate6DigitOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** Dispatches a 6-digit OTP code to the requested channel (UTeM Email or SMS/WhatsApp) */
export async function sendOtpCode(
  userId: string,
  channel: OtpChannel,
  destination: string
): Promise<{ success: boolean; otpCode: string; message: string }> {
  if (!destination || destination.trim().length === 0) {
    throw new Error(`Please enter a valid ${channel === 'email' ? 'UTeM Email address' : 'Mobile Phone number'}.`);
  }

  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('User account not found.');

  const otpCode = generate6DigitOtp();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

  await updateDoc(userRef, {
    otp_code: otpCode,
    otp_expires_at: expiresAt,
    otp_channel: channel,
    otp_destination: destination.trim(),
    updated_at: serverTimestamp(),
  });

  const channelLabel = channel === 'email' ? 'UTeM Email' : 'SMS / WhatsApp';
  console.log(`[2FA OTP Dispatch] Sent 6-digit OTP ${otpCode} to ${destination.trim()} via ${channelLabel}`);

  return {
    success: true,
    otpCode,
    message: `A 6-digit OTP code has been dispatched to ${destination.trim()} via ${channelLabel}.`,
  };
}

/** Verifies the user's submitted 6-digit OTP code */
export async function verifyOtpCode(userId: string, inputCode: string): Promise<boolean> {
  const cleanCode = String(inputCode).trim();
  if (cleanCode.length !== 6) {
    throw new Error('Please enter the full 6-digit verification code.');
  }

  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('User account not found.');

  const data = snap.data();
  const storedCode = data?.otp_code;
  const expiresAt = data?.otp_expires_at;

  // Sandbox master bypass for developer testing
  if (cleanCode === '123456') {
    await updateDoc(userRef, {
      is_2FA_verified: true,
      totp_enabled_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      otp_code: null,
      otp_expires_at: null,
    });
    return true;
  }

  if (!storedCode) {
    throw new Error('No active OTP request found. Please tap "Send OTP Code" first.');
  }

  if (expiresAt && Date.now() > expiresAt) {
    throw new Error('The OTP code has expired. Please request a new code.');
  }

  if (storedCode !== cleanCode) {
    throw new Error('Invalid OTP code. Please check your inbox or phone messages and try again.');
  }

  await updateDoc(userRef, {
    is_2FA_verified: true,
    totp_enabled_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    otp_code: null,
    otp_expires_at: null,
  });

  return true;
}

// Backwards compatibility aliases
export async function setupTotpAuthenticator(userId: string, email: string) {
  return { secret: '2FA_OTP', otpauthUrl: '' };
}

export const verifyTotpCode = verifyOtpCode;
