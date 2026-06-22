const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

admin.initializeApp();

const gmailUser = defineSecret('GMAIL_USER');
const gmailPass = defineSecret('GMAIL_APP_PASSWORD');

function createTransporter(user, pass) {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user, pass },
  });
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

exports.sendOtpEmail = onCall(
  { secrets: [gmailUser, gmailPass], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be logged in to request a verification code.');
    }

    const { userId, email } = request.data || {};
    if (!userId || !email) {
      throw new HttpsError('invalid-argument', 'userId and email are required.');
    }

    const db = admin.firestore();
    const uidSnap = await db.doc(`uid_index/${request.auth.uid}`).get();
    if (!uidSnap.exists || uidSnap.data()?.studentId !== userId) {
      throw new HttpsError('permission-denied', 'You can only request a code for your own account.');
    }

    const userSnap = await db.doc(`users/${userId}`).get();
    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'User profile not found.');
    }

    const profile = userSnap.data();
    if (profile.email !== email) {
      throw new HttpsError('permission-denied', 'Email does not match your profile.');
    }

    const code = generateOtp();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    await db.doc(`users/${userId}`).update({
      otp_code: code,
      otp_expires_at: expiresAt,
      otp_email: email,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    const fromAddress = gmailUser.value();
    const transporter = createTransporter(fromAddress, gmailPass.value());

    try {
      await transporter.sendMail({
        from: `"UTeM Ride" <${fromAddress}>`,
        to: email,
        replyTo: fromAddress,
        subject: 'UTeM Ride — Your verification code',
        text:
          `Your UTeM Ride verification code is: ${code}\n\n` +
          'This code expires in 10 minutes.\n\n' +
          'If you did not request this, you can ignore this email.',
        html:
          `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto">` +
          `<h2 style="color:#0057B8">UTeM Ride</h2>` +
          `<p>Your verification code is:</p>` +
          `<p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p>` +
          `<p style="color:#666">Valid for 10 minutes.</p>` +
          `</div>`,
      });
    } catch (err) {
      console.error('[sendOtpEmail] SMTP error:', err);
      throw new HttpsError('internal', 'Failed to send verification email. Check Gmail SMTP settings.');
    }

    return { success: true, expiresAt };
  }
);
