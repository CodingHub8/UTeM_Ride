import 'react-native-get-random-values';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { db } from '@/utils/firebase';

const TOTP_ISSUER = 'UTeM Ride';

export async function setupTotpAuthenticator(userId: string, email: string) {
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('User not found.');

  let secret = snap.data()?.totp_secret as string | undefined;
  if (!secret) {
    secret = generateSecret();
    await updateDoc(userRef, {
      totp_secret: secret,
      totp_email: email,
      updated_at: serverTimestamp(),
    });
  }

  const otpauthUrl = generateURI({
    issuer: TOTP_ISSUER,
    label: email,
    secret,
  });

  return { otpauthUrl, secret };
}

export async function verifyTotpCode(userId: string, inputCode: string) {
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) throw new Error('User not found.');

  const secret = snap.data()?.totp_secret as string | undefined;
  if (!secret) {
    throw new Error('Authenticator not set up yet. Scan the QR code first.');
  }

  const result = verifySync({
    secret,
    token: String(inputCode).trim(),
    epochTolerance: 30,
  });

  if (!result.valid) {
    throw new Error('Invalid code. Open Google Authenticator and enter the current 6-digit code.');
  }

  await updateDoc(userRef, {
    is_2FA_verified: true,
    totp_enabled_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    otp_code: null,
    otp_expires_at: null,
  });
}
