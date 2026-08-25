import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/utils/firebase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { sendOtpCode, verifyOtpCode, OtpChannel } from '@/utils/twoFactor';

const COOLDOWN_KEY = '@utem_ride_2fa_cooldown_';

interface TwoFactorModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  email: string;
  phoneNumber?: string;
  onVerified: () => void;
  isDark: boolean;
}

export default function TwoFactorModal({
  visible,
  onClose,
  userId,
  email,
  phoneNumber = '',
  onVerified,
  isDark,
}: TwoFactorModalProps) {
  const [channel, setChannel] = useState<OtpChannel>('email');
  const [phoneInput, setPhoneInput] = useState(phoneNumber);
  const [emailInput, setEmailInput] = useState(email);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const dynamic = {
    card: { backgroundColor: isDark ? Colors.darkCard : Colors.white },
    text: { color: isDark ? Colors.white : Colors.gray900 },
    sub: { color: isDark ? Colors.gray400 : Colors.gray500 },
    input: {
      backgroundColor: isDark ? Colors.gray900 : Colors.gray50,
      color: isDark ? Colors.white : Colors.gray900,
      borderColor: isDark ? Colors.darkBorder : Colors.gray200,
    },
    tabInactive: {
      backgroundColor: isDark ? Colors.gray900 : Colors.gray100,
      borderColor: isDark ? Colors.darkBorder : Colors.gray200,
    },
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  useEffect(() => {
    if (!visible || !userId) return;
    setEmailInput(email);
    setPhoneInput(phoneNumber);
    setCode('');

    const checkPersistedCooldown = async () => {
      try {
        const storedEndTime = await AsyncStorage.getItem(COOLDOWN_KEY + userId);
        if (storedEndTime) {
          const endTime = parseInt(storedEndTime, 10);
          const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
          if (remaining > 0) {
            setResendTimer(remaining);
            setOtpSent(true);
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to check 2FA cooldown:', e);
      }
    };
    checkPersistedCooldown();
  }, [visible, email, phoneNumber, userId]);

  // Real-time listener: Auto-close modal as soon as 2FA status becomes verified
  useEffect(() => {
    if (!visible || !userId) return;
    const userRef = doc(db, 'users', userId);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists() && snap.data()?.is_2FA_verified) {
        onVerified();
        onClose();
        Alert.alert('Success 🎉', 'Two-Factor Authentication (2FA) is verified and enabled.');
      }
    });
    return unsub;
  }, [visible, userId]);

  const handleSendOtp = async () => {
    const destination = channel === 'email' ? emailInput : phoneInput;
    if (!destination || destination.trim().length === 0) {
      Alert.alert(
        'Missing Destination',
        `Please enter a valid ${channel === 'email' ? 'UTeM email address' : 'mobile phone number'}.`
      );
      return;
    }

    // Instant UI transition
    setOtpSent(true);
    setResendTimer(60);
    setLoading(true);

    const cooldownEndTime = Date.now() + 60000;
    AsyncStorage.setItem(COOLDOWN_KEY + userId, String(cooldownEndTime)).catch(() => {});

    try {
      await sendOtpCode(userId, channel, destination);

      if (channel === 'email') {
        Alert.alert(
          'Verification Email Sent',
          `A verification link has been dispatched to ${destination.trim()}.\n\nPlease check your inbox and tap the link to verify your account.`
        );
      } else {
        Alert.alert(
          '2FA Verification Code Sent',
          `A 6-digit verification code has been sent via SMS to ${destination.trim()}.\n\nPlease enter the code below.`
        );
      }
    } catch (err: any) {
      Alert.alert('Send Failed', err.message || 'Failed to dispatch 2FA code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.trim().length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the complete 6-digit OTP code.');
      return;
    }

    setLoading(true);
    try {
      await verifyOtpCode(userId, code);
      setCode('');
      onVerified();
      onClose();
      Alert.alert('Success 🎉', 'Two-Factor Authentication (2FA) is now verified and enabled for your account.');
    } catch (e: any) {
      Alert.alert('Verification Failed', e.message || 'Invalid code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, dynamic.card]}>
            <View style={styles.headerRow}>
              <Ionicons name="shield-checkmark" size={28} color={Colors.primary} />
              <Text style={[styles.title, dynamic.text]}>2FA Security Verification</Text>
            </View>

            <Text style={[styles.sub, dynamic.sub]}>
              Select your preferred channel to verify your account:
            </Text>

            {/* Channel Tabs */}
            <View style={styles.channelContainer}>
              <TouchableOpacity
                style={[
                  styles.channelTab,
                  channel === 'email' ? styles.channelTabActive : dynamic.tabInactive,
                ]}
                onPress={() => { setChannel('email'); setOtpSent(false); setCode(''); }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={channel === 'email' ? Colors.white : isDark ? Colors.gray300 : Colors.gray700}
                />
                <Text
                  style={[
                    styles.channelTabText,
                    channel === 'email' ? styles.channelTabTextActive : dynamic.sub,
                  ]}
                >
                  UTeM Email Link
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.channelTab,
                  channel === 'sms' ? styles.channelTabActive : dynamic.tabInactive,
                ]}
                onPress={() => { setChannel('sms'); setOtpSent(false); setCode(''); }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="chatbox-ellipses-outline"
                  size={18}
                  color={channel === 'sms' ? Colors.white : isDark ? Colors.gray300 : Colors.gray700}
                />
                <Text
                  style={[
                    styles.channelTabText,
                    channel === 'sms' ? styles.channelTabTextActive : dynamic.sub,
                  ]}
                >
                  SMS Phone OTP
                </Text>
              </TouchableOpacity>
            </View>

            {/* Destination Input Field */}
            {channel === 'email' ? (
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, dynamic.sub]}>UTeM Student / Staff Email</Text>
                <TextInput
                  style={[styles.input, dynamic.input]}
                  value={emailInput}
                  onChangeText={setEmailInput}
                  placeholder="name@student.utem.edu.my"
                  placeholderTextColor={Colors.gray400}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            ) : (
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, dynamic.sub]}>Mobile Phone Number (SMS)</Text>
                <TextInput
                  style={[styles.input, dynamic.input]}
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                  placeholder="+60123456789"
                  placeholderTextColor={Colors.gray400}
                  keyboardType="phone-pad"
                />
              </View>
            )}

            {/* Send Request Button */}
            <TouchableOpacity
              style={[styles.sendBtn, resendTimer > 0 && styles.disabledBtn]}
              onPress={handleSendOtp}
              disabled={loading || resendTimer > 0}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.sendBtnText}>
                  {resendTimer > 0
                    ? `Resend in ${resendTimer}s`
                    : channel === 'email'
                    ? otpSent ? 'Resend Verification Email' : 'Send Verification Email'
                    : otpSent ? 'Resend 6-Digit SMS OTP' : 'Send 6-Digit SMS OTP'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Email Status vs SMS Code Input */}
            {channel === 'email' && otpSent && (
              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
                <Text style={[styles.infoText, dynamic.sub]}>
                  A verification link was sent to <Text style={{ fontWeight: 'bold' }}>{emailInput}</Text>. Check your inbox and tap the link to verify. This window will close automatically once verified.
                </Text>
              </View>
            )}

            {channel === 'sms' && (
              <>
                <View style={[styles.fieldGroup, { marginTop: Spacing.md }]}>
                  <Text style={[styles.label, dynamic.sub]}>Enter 6-Digit SMS Code</Text>
                  <TextInput
                    style={[styles.otpInput, dynamic.input]}
                    value={code}
                    onChangeText={setCode}
                    placeholder="──────"
                    placeholderTextColor={Colors.gray400}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>

                <TouchableOpacity style={styles.primaryBtn} onPress={handleVerify} disabled={loading || code.length < 6}>
                  {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryText}>Verify & Enable 2FA</Text>}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={[styles.cancelText, dynamic.sub]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },
  card: { borderRadius: BorderRadius.lg, padding: Spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  sub: { fontSize: FontSize.sm, marginBottom: Spacing.md, lineHeight: 20 },
  channelContainer: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  channelTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  channelTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  channelTabText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  channelTabTextActive: { color: Colors.white },
  fieldGroup: { marginBottom: Spacing.sm },
  label: { fontSize: FontSize.xs, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: FontSize.md,
  },
  otpInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  sendBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  disabledBtn: { opacity: 0.6 },
  sendBtnText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary + '15',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  infoText: { flex: 1, fontSize: FontSize.xs, lineHeight: 18 },
  primaryBtn: {
    backgroundColor: Colors.success,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  primaryText: { color: Colors.white, fontWeight: FontWeight.bold, fontSize: FontSize.md },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.sm, marginTop: Spacing.xs },
  cancelText: { fontSize: FontSize.sm },
});
